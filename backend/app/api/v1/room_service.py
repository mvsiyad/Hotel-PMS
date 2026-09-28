"""
Room service menu + orders endpoints.
"""

import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ...db.session import get_db
from ...models.room_service import RoomServiceMenuItem, RoomServiceOrder
from ...schemas import (
    MenuItemCreate, MenuItemUpdate, MenuItemResponse,
    RoomServiceOrderCreate, RoomServiceOrderUpdate, RoomServiceOrderResponse,
)
from ...core.dependencies import get_current_staff, require_hotel_access, require_permission
from ...core.permissions import Permission

router = APIRouter(prefix="/hotels/{hotel_id}/room-service", tags=["Room Service"])


# ── Menu ──────────────────────────────────────────────────────────────────────

@router.get("/menu", response_model=List[MenuItemResponse])
async def list_menu(
    hotel_id: int,
    category: Optional[str] = Query(None),
    available_only: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    actor=Depends(require_permission(Permission.VIEW_ROOM_SERVICE)),
):
    require_hotel_access(hotel_id, actor)
    q = select(RoomServiceMenuItem).where(RoomServiceMenuItem.hotel_id == hotel_id)
    if available_only:
        q = q.where(RoomServiceMenuItem.is_available == True)
    if category:
        q = q.where(RoomServiceMenuItem.category == category)
    result = await db.execute(q.order_by(RoomServiceMenuItem.category, RoomServiceMenuItem.name))
    return result.scalars().all()


@router.post("/menu", response_model=MenuItemResponse, status_code=201)
async def create_menu_item(
    hotel_id: int,
    body: MenuItemCreate,
    db: AsyncSession = Depends(get_db),
    actor=Depends(require_permission(Permission.MANAGE_ROOM_SERVICE)),
):
    require_hotel_access(hotel_id, actor)
    item = RoomServiceMenuItem(hotel_id=hotel_id, **body.model_dump())
    db.add(item)
    await db.flush()
    return item


@router.patch("/menu/{item_id}", response_model=MenuItemResponse)
async def update_menu_item(
    hotel_id: int,
    item_id: int,
    body: MenuItemUpdate,
    db: AsyncSession = Depends(get_db),
    actor=Depends(require_permission(Permission.MANAGE_ROOM_SERVICE)),
):
    require_hotel_access(hotel_id, actor)
    result = await db.execute(
        select(RoomServiceMenuItem).where(
            RoomServiceMenuItem.id == item_id, RoomServiceMenuItem.hotel_id == hotel_id
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Menu item not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(item, k, v)
    return item


# ── Orders ────────────────────────────────────────────────────────────────────

@router.get("/orders", response_model=List[RoomServiceOrderResponse])
async def list_orders(
    hotel_id: int,
    status: Optional[str] = Query(None),
    room_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    actor=Depends(require_permission(Permission.VIEW_ROOM_SERVICE)),
):
    require_hotel_access(hotel_id, actor)
    q = select(RoomServiceOrder).where(RoomServiceOrder.hotel_id == hotel_id)
    if status:
        q = q.where(RoomServiceOrder.status == status)
    if room_id:
        q = q.where(RoomServiceOrder.room_id == room_id)
    result = await db.execute(q.order_by(RoomServiceOrder.created_at.desc()))
    return result.scalars().all()


@router.post("/orders", response_model=RoomServiceOrderResponse, status_code=201)
async def create_order(
    hotel_id: int,
    body: RoomServiceOrderCreate,
    db: AsyncSession = Depends(get_db),
    actor=Depends(require_permission(Permission.MANAGE_ROOM_SERVICE)),
):
    require_hotel_access(hotel_id, actor)
    # Build order items with resolved prices
    items_detail = []
    total = 0.0
    for order_item in body.items:
        menu_result = await db.execute(
            select(RoomServiceMenuItem).where(
                RoomServiceMenuItem.id == order_item.item_id,
                RoomServiceMenuItem.hotel_id == hotel_id,
                RoomServiceMenuItem.is_available == True,
            )
        )
        menu_item = menu_result.scalar_one_or_none()
        if not menu_item:
            raise HTTPException(404, f"Menu item {order_item.item_id} not found or unavailable")
        line_total = menu_item.price * order_item.quantity
        total += line_total
        items_detail.append({
            "item_id": menu_item.id,
            "name": menu_item.name,
            "quantity": order_item.quantity,
            "unit_price": menu_item.price,
            "line_total": line_total,
        })

    order = RoomServiceOrder(
        hotel_id=hotel_id,
        room_id=body.room_id,
        reservation_id=body.reservation_id,
        guest_id=body.guest_id,
        items_json=json.dumps(items_detail),
        total_amount=total,
        special_instructions=body.special_instructions,
        status="PLACED",
    )
    db.add(order)
    await db.flush()
    return order


@router.patch("/orders/{order_id}", response_model=RoomServiceOrderResponse)
async def update_order(
    hotel_id: int,
    order_id: int,
    body: RoomServiceOrderUpdate,
    db: AsyncSession = Depends(get_db),
    actor=Depends(require_permission(Permission.MANAGE_ROOM_SERVICE)),
):
    require_hotel_access(hotel_id, actor)
    result = await db.execute(
        select(RoomServiceOrder).where(
            RoomServiceOrder.id == order_id, RoomServiceOrder.hotel_id == hotel_id
        )
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(404, "Order not found")

    VALID_TRANSITIONS = {
        "PLACED": ["CONFIRMED", "CANCELLED"],
        "CONFIRMED": ["PREPARING", "CANCELLED"],
        "PREPARING": ["READY"],
        "READY": ["DELIVERED"],
        "DELIVERED": [],
        "CANCELLED": [],
    }
    if body.status and body.status != order.status:
        if body.status not in VALID_TRANSITIONS.get(order.status, []):
            raise HTTPException(
                400, f"Invalid order status transition: {order.status} → {body.status}"
            )
        order.status = body.status
    if body.assigned_staff_id is not None:
        order.assigned_staff_id = body.assigned_staff_id
    return order

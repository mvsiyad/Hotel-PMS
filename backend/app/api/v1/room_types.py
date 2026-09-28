"""
Room types CRUD endpoints.
"""

import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ...db.session import get_db
from ...models.room_type import RoomType
from ...schemas import RoomTypeCreate, RoomTypeUpdate, RoomTypeResponse
from ...core.dependencies import get_current_actor, require_hotel_access, require_scope, require_permission
from ...core.permissions import IntegrationScope, Permission
from ...services.audit_service import log_action

router = APIRouter(prefix="/hotels/{hotel_id}/room-types", tags=["Room Types"])


@router.get("", response_model=List[RoomTypeResponse])
async def list_room_types(
    hotel_id: int,
    db: AsyncSession = Depends(get_db),
    actor=Depends(require_scope(IntegrationScope.READ_ROOM_TYPES)),
):
    require_hotel_access(hotel_id, actor)
    result = await db.execute(
        select(RoomType).where(RoomType.hotel_id == hotel_id)
    )
    return result.scalars().all()


@router.post("", response_model=RoomTypeResponse, status_code=201)
async def create_room_type(
    hotel_id: int,
    body: RoomTypeCreate,
    db: AsyncSession = Depends(get_db),
    actor=Depends(require_permission(Permission.MANAGE_ROOM_TYPES)),
):
    require_hotel_access(hotel_id, actor)
    amenities_json = json.dumps(body.amenities) if body.amenities else None
    rt = RoomType(
        hotel_id=hotel_id,
        name=body.name,
        description=body.description,
        capacity=body.capacity,
        base_rate=body.base_rate,
        amenities=amenities_json,
    )
    db.add(rt)
    await db.flush()
    await log_action(
        db, "CREATE_ROOM_TYPE",
        hotel_id=hotel_id,
        actor_type="STAFF", actor_id=getattr(actor, "id", None),
        actor_name=getattr(actor, "full_name", "Unknown"),
        resource_type="room_type", resource_id=rt.id,
        details={"name": rt.name, "base_rate": rt.base_rate},
    )
    return rt


@router.get("/{rt_id}", response_model=RoomTypeResponse)
async def get_room_type(
    hotel_id: int,
    rt_id: int,
    db: AsyncSession = Depends(get_db),
    actor=Depends(require_scope(IntegrationScope.READ_ROOM_TYPES)),
):
    require_hotel_access(hotel_id, actor)
    result = await db.execute(
        select(RoomType).where(RoomType.id == rt_id, RoomType.hotel_id == hotel_id)
    )
    rt = result.scalar_one_or_none()
    if not rt:
        raise HTTPException(404, "Room type not found")
    return rt


@router.patch("/{rt_id}", response_model=RoomTypeResponse)
async def update_room_type(
    hotel_id: int,
    rt_id: int,
    body: RoomTypeUpdate,
    db: AsyncSession = Depends(get_db),
    actor=Depends(require_permission(Permission.MANAGE_ROOM_TYPES)),
):
    require_hotel_access(hotel_id, actor)
    result = await db.execute(
        select(RoomType).where(RoomType.id == rt_id, RoomType.hotel_id == hotel_id)
    )
    rt = result.scalar_one_or_none()
    if not rt:
        raise HTTPException(404, "Room type not found")
    updates = body.model_dump(exclude_none=True)
    if "amenities" in updates:
        updates["amenities"] = json.dumps(updates["amenities"])
    for k, v in updates.items():
        setattr(rt, k, v)
    await log_action(
        db, "UPDATE_ROOM_TYPE",
        hotel_id=hotel_id,
        actor_type="STAFF", actor_id=getattr(actor, "id", None),
        actor_name=getattr(actor, "full_name", "Unknown"),
        resource_type="room_type", resource_id=rt_id,
        details=updates,
    )
    return rt

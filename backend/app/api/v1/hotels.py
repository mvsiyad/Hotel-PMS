"""
Hotels CRUD endpoints – PMS Admin only for create/update.
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ...db.session import get_db
from ...models.hotel import Hotel
from ...schemas import HotelCreate, HotelUpdate, HotelResponse
from ...core.dependencies import get_current_staff, get_current_admin
from ...services.audit_service import log_action

router = APIRouter(prefix="/hotels", tags=["Hotels"])


@router.get("", response_model=List[HotelResponse])
async def list_hotels(
    db: AsyncSession = Depends(get_db),
    actor=Depends(get_current_staff),
):
    result = await db.execute(select(Hotel))
    hotels = result.scalars().all()
    # Non-admins only see their own hotel
    if actor.role != "PMS_ADMIN" and actor.hotel_id:
        hotels = [h for h in hotels if h.id == actor.hotel_id]
    return hotels


@router.post("", response_model=HotelResponse, status_code=201)
async def create_hotel(
    body: HotelCreate,
    db: AsyncSession = Depends(get_db),
    actor=Depends(get_current_admin),
):
    hotel = Hotel(**body.model_dump())
    db.add(hotel)
    await db.flush()
    await log_action(
        db, "CREATE_HOTEL",
        actor_type="STAFF", actor_id=actor.id, actor_name=actor.full_name,
        resource_type="hotel", resource_id=hotel.id,
        details={"name": hotel.name},
    )
    return hotel


@router.get("/{hotel_id}", response_model=HotelResponse)
async def get_hotel(
    hotel_id: int,
    db: AsyncSession = Depends(get_db),
    actor=Depends(get_current_staff),
):
    result = await db.execute(select(Hotel).where(Hotel.id == hotel_id))
    hotel = result.scalar_one_or_none()
    if not hotel:
        raise HTTPException(404, "Hotel not found")
    if actor.role != "PMS_ADMIN" and actor.hotel_id != hotel_id:
        raise HTTPException(403, "Cross-property access denied")
    return hotel


@router.patch("/{hotel_id}", response_model=HotelResponse)
async def update_hotel(
    hotel_id: int,
    body: HotelUpdate,
    db: AsyncSession = Depends(get_db),
    actor=Depends(get_current_admin),
):
    result = await db.execute(select(Hotel).where(Hotel.id == hotel_id))
    hotel = result.scalar_one_or_none()
    if not hotel:
        raise HTTPException(404, "Hotel not found")
    updates = body.model_dump(exclude_none=True)
    for k, v in updates.items():
        setattr(hotel, k, v)
    await log_action(
        db, "UPDATE_HOTEL",
        actor_type="STAFF", actor_id=actor.id, actor_name=actor.full_name,
        resource_type="hotel", resource_id=hotel_id,
        details=updates,
    )
    return hotel

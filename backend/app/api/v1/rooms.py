"""
Rooms CRUD + status management with FSM enforcement.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ...db.session import get_db
from ...models.room import Room, transition_room
from ...schemas import RoomCreate, RoomUpdate, RoomResponse, RoomStatusUpdate
from ...core.dependencies import get_current_actor, get_current_staff, require_hotel_access, require_scope, require_permission
from ...core.permissions import IntegrationScope, Permission
from ...services.audit_service import log_action

router = APIRouter(prefix="/hotels/{hotel_id}/rooms", tags=["Rooms"])


@router.get("", response_model=List[RoomResponse])
async def list_rooms(
    hotel_id: int,
    status: Optional[str] = Query(None),
    floor: Optional[int] = Query(None),
    room_type_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    actor=Depends(require_scope(IntegrationScope.READ_ROOMS)),
):
    require_hotel_access(hotel_id, actor)
    q = select(Room).where(Room.hotel_id == hotel_id)
    if status:
        q = q.where(Room.status == status)
    if floor:
        q = q.where(Room.floor == floor)
    if room_type_id:
        q = q.where(Room.room_type_id == room_type_id)
    result = await db.execute(q.order_by(Room.room_number))
    return result.scalars().all()


@router.post("", response_model=RoomResponse, status_code=201)
async def create_room(
    hotel_id: int,
    body: RoomCreate,
    db: AsyncSession = Depends(get_db),
    actor=Depends(require_permission(Permission.MANAGE_ROOMS)),
):
    require_hotel_access(hotel_id, actor)
    # Check for duplicate room number in same hotel
    existing = await db.execute(
        select(Room).where(Room.hotel_id == hotel_id, Room.room_number == body.room_number)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, f"Room {body.room_number} already exists in this hotel")

    room = Room(hotel_id=hotel_id, **body.model_dump(), status="READY")
    db.add(room)
    await db.flush()
    await log_action(
        db, "CREATE_ROOM",
        hotel_id=hotel_id, actor_type="STAFF", actor_id=actor.id, actor_name=actor.full_name,
        resource_type="room", resource_id=room.id,
        details={"room_number": room.room_number, "floor": room.floor},
    )
    return room


@router.get("/{room_id}", response_model=RoomResponse)
async def get_room(
    hotel_id: int,
    room_id: int,
    db: AsyncSession = Depends(get_db),
    actor=Depends(require_scope(IntegrationScope.READ_ROOMS)),
):
    require_hotel_access(hotel_id, actor)
    result = await db.execute(
        select(Room).where(Room.id == room_id, Room.hotel_id == hotel_id)
    )
    room = result.scalar_one_or_none()
    if not room:
        raise HTTPException(404, "Room not found")
    return room


@router.patch("/{room_id}", response_model=RoomResponse)
async def update_room(
    hotel_id: int,
    room_id: int,
    body: RoomUpdate,
    db: AsyncSession = Depends(get_db),
    actor=Depends(require_permission(Permission.MANAGE_ROOMS)),
):
    require_hotel_access(hotel_id, actor)
    result = await db.execute(
        select(Room).where(Room.id == room_id, Room.hotel_id == hotel_id)
    )
    room = result.scalar_one_or_none()
    if not room:
        raise HTTPException(404, "Room not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(room, k, v)
    return room


@router.patch("/{room_id}/status", response_model=RoomResponse)
async def update_room_status(
    hotel_id: int,
    room_id: int,
    body: RoomStatusUpdate,
    db: AsyncSession = Depends(get_db),
    actor=Depends(require_permission(Permission.MANAGE_ROOMS)),
):
    """Update room status with FSM validation."""
    require_hotel_access(hotel_id, actor)
    result = await db.execute(
        select(Room).where(Room.id == room_id, Room.hotel_id == hotel_id)
    )
    room = result.scalar_one_or_none()
    if not room:
        raise HTTPException(404, "Room not found")

    old_status = room.status
    transition_room(room, body.status)

    await log_action(
        db, "ROOM_STATUS_CHANGED",
        hotel_id=hotel_id, actor_type="STAFF", actor_id=actor.id, actor_name=actor.full_name,
        resource_type="room", resource_id=room_id,
        details={"from": old_status, "to": body.status, "reason": body.reason},
    )
    return room

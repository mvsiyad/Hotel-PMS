"""
Reservation service: business logic for creating, modifying,
checking-in, checking-out reservations.
"""

from datetime import date, datetime
import uuid
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from fastapi import HTTPException

from ..models.reservation import Reservation, RESERVATION_STATUS_TRANSITIONS
from ..models.room import Room, transition_room
from ..models.room_type import RoomType
from ..models.guest import Guest
from ..models.housekeeping import HousekeepingTask
from ..schemas import ReservationCreate, CheckInRequest, CheckOutRequest
from .audit_service import log_action


def _confirmation_number() -> str:
    return f"PMS{str(uuid.uuid4()).upper().replace('-', '')[:8]}"


async def create_reservation(
    db: AsyncSession,
    hotel_id: int,
    data: ReservationCreate,
    created_by_id: Optional[int] = None,
) -> Reservation:
    """Create a reservation, preventing double-booking."""
    # Check guest exists in this hotel
    guest_result = await db.execute(
        select(Guest).where(Guest.id == data.guest_id, Guest.hotel_id == hotel_id)
    )
    if not guest_result.scalar_one_or_none():
        raise HTTPException(404, "Guest not found in this hotel")

    # Check room type exists in this hotel
    rt_result = await db.execute(
        select(RoomType).where(RoomType.id == data.room_type_id, RoomType.hotel_id == hotel_id)
    )
    room_type = rt_result.scalar_one_or_none()
    if not room_type:
        raise HTTPException(404, "Room type not found")

    if data.check_out_date <= data.check_in_date:
        raise HTTPException(400, "check_out_date must be after check_in_date")

    # Count total sellable rooms of this type
    total_rooms_result = await db.execute(
        select(func.count(Room.id)).where(
            Room.hotel_id == hotel_id,
            Room.room_type_id == data.room_type_id,
            Room.status.not_in(["OUT_OF_ORDER", "MAINTENANCE"]),
        )
    )
    total_rooms = total_rooms_result.scalar() or 0
    if total_rooms == 0:
        raise HTTPException(409, "No available rooms configured for this room type")

    # Count overlapping active reservations
    overlap_result = await db.execute(
        select(func.count(Reservation.id)).where(
            Reservation.hotel_id == hotel_id,
            Reservation.room_type_id == data.room_type_id,
            Reservation.status.in_(["CONFIRMED", "CHECKED_IN"]),
            Reservation.check_in_date < data.check_out_date,
            Reservation.check_out_date > data.check_in_date,
        )
    )
    overlap_count = overlap_result.scalar() or 0

    if overlap_count >= total_rooms:
        raise HTTPException(409, "No availability for the requested dates and room type")

    # Use base rate if not specified
    rate = data.rate if data.rate is not None else room_type.base_rate
    nights = (data.check_out_date - data.check_in_date).days
    total = rate * nights

    res = Reservation(
        confirmation_number=_confirmation_number(),
        hotel_id=hotel_id,
        guest_id=data.guest_id,
        room_type_id=data.room_type_id,
        check_in_date=data.check_in_date,
        check_out_date=data.check_out_date,
        adults=data.adults,
        children=data.children,
        status="CONFIRMED",
        rate=rate,
        total_amount=total,
        special_requests=data.special_requests,
        notes=data.notes,
        created_by_id=created_by_id,
    )
    db.add(res)
    await db.flush()

    await log_action(
        db,
        "CREATE_RESERVATION",
        hotel_id=hotel_id,
        actor_type="STAFF" if created_by_id else "SYSTEM",
        actor_id=created_by_id,
        actor_name="Staff" if created_by_id else "System",
        resource_type="reservation",
        resource_id=res.id,
        details={
            "confirmation_number": res.confirmation_number,
            "guest_id": data.guest_id,
            "check_in": str(data.check_in_date),
            "check_out": str(data.check_out_date),
        },
    )
    return res


async def check_in(
    db: AsyncSession,
    hotel_id: int,
    reservation_id: int,
    data: CheckInRequest,
    actor=None,
) -> Reservation:
    """Check in a guest: assign room, update statuses."""
    res_result = await db.execute(
        select(Reservation).where(
            Reservation.id == reservation_id, Reservation.hotel_id == hotel_id
        )
    )
    res = res_result.scalar_one_or_none()
    if not res:
        raise HTTPException(404, "Reservation not found")
    if res.status != "CONFIRMED":
        raise HTTPException(400, f"Cannot check in a reservation with status: {res.status}")

    # Validate room
    room_result = await db.execute(
        select(Room).where(Room.id == data.room_id, Room.hotel_id == hotel_id)
    )
    room = room_result.scalar_one_or_none()
    if not room:
        raise HTTPException(404, "Room not found")

    if room.room_type_id != res.room_type_id:
        raise HTTPException(
            400,
            f"Room {room.room_number} does not match reservation room type",
        )

    if room.status not in ("READY", "AVAILABLE", "CLEAN", "INSPECTED"):
        raise HTTPException(
            400,
            f"Room {room.room_number} is not ready for check-in. Current status: {room.status}",
        )

    # Check that room is not already occupied by another active reservation
    active_occ = await db.execute(
        select(Reservation).where(
            Reservation.room_id == data.room_id,
            Reservation.status == "CHECKED_IN",
            Reservation.id != reservation_id,
        )
    )
    if active_occ.scalar_one_or_none():
        raise HTTPException(400, f"Room {room.room_number} is already occupied")

    # Update reservation
    res.status = "CHECKED_IN"
    res.room_id = data.room_id
    res.checked_in_at = datetime.utcnow()
    if data.notes:
        res.notes = (res.notes or "") + f"\nCheck-in: {data.notes}"

    # Update room status
    transition_room(room, "OCCUPIED")

    actor_name = actor.full_name if actor else "System"
    actor_id = actor.id if actor else None
    actor_type = "STAFF" if actor else "SYSTEM"

    await log_action(
        db,
        "CHECK_IN",
        hotel_id=hotel_id,
        actor_type=actor_type,
        actor_id=actor_id,
        actor_name=actor_name,
        resource_type="reservation",
        resource_id=reservation_id,
        details={
            "confirmation": res.confirmation_number,
            "room": room.room_number,
            "guest_id": res.guest_id,
        },
    )
    await db.flush()
    await db.refresh(res)
    return res


async def check_out(
    db: AsyncSession,
    hotel_id: int,
    reservation_id: int,
    data: CheckOutRequest,
    actor=None,
) -> Reservation:
    """Check out a guest: change room to DIRTY, auto-create housekeeping task."""
    res_result = await db.execute(
        select(Reservation).where(
            Reservation.id == reservation_id, Reservation.hotel_id == hotel_id
        )
    )
    res = res_result.scalar_one_or_none()
    if not res:
        raise HTTPException(404, "Reservation not found")
    if res.status != "CHECKED_IN":
        raise HTTPException(400, f"Cannot check out: reservation status is {res.status}")

    # Update reservation
    res.status = "CHECKED_OUT"
    res.checked_out_at = datetime.utcnow()
    if data.notes:
        res.notes = (res.notes or "") + f"\nCheck-out: {data.notes}"

    # Change room to DIRTY
    room_result = await db.execute(select(Room).where(Room.id == res.room_id))
    room = room_result.scalar_one_or_none()
    if room:
        transition_room(room, "DIRTY")

        # Auto-create housekeeping task
        hk_task = HousekeepingTask(
            hotel_id=hotel_id,
            room_id=room.id,
            reservation_id=reservation_id,
            task_type="CHECKOUT",
            priority="HIGH",
            status="PENDING",
            notes=f"Auto-created on checkout. Reservation: {res.confirmation_number}",
        )
        db.add(hk_task)

    actor_name = actor.full_name if actor else "System"
    actor_id = actor.id if actor else None
    actor_type = "STAFF" if actor else "SYSTEM"

    await log_action(
        db,
        "CHECK_OUT",
        hotel_id=hotel_id,
        actor_type=actor_type,
        actor_id=actor_id,
        actor_name=actor_name,
        resource_type="reservation",
        resource_id=reservation_id,
        details={
            "confirmation": res.confirmation_number,
            "room_id": res.room_id,
            "room_number": room.room_number if room else None,
        },
    )
    await db.flush()
    await db.refresh(res)
    return res

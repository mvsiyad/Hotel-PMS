"""
Availability calculation service.
Computes real-time room availability from actual database state.
Never returns hardcoded values.
"""

from datetime import date
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, not_

from ..models.room import Room
from ..models.room_type import RoomType
from ..models.reservation import Reservation
from ..schemas import AvailabilityResult


async def calculate_availability(
    db: AsyncSession,
    hotel_id: int,
    check_in_date: date,
    check_out_date: date,
    room_type_id: Optional[int] = None,
) -> list[AvailabilityResult]:
    """
    Calculate available rooms per room type for the given date range.

    Logic:
        Total rooms of type
        - Rooms with OUT_OF_ORDER or MAINTENANCE status
        - Rooms with overlapping CONFIRMED or CHECKED_IN reservations
        = Available rooms
    """
    # Get room types
    rt_query = select(RoomType).where(
        RoomType.hotel_id == hotel_id,
        RoomType.status == "ACTIVE",
    )
    if room_type_id:
        rt_query = rt_query.where(RoomType.id == room_type_id)

    rt_result = await db.execute(rt_query)
    room_types = rt_result.scalars().all()

    nights = (check_out_date - check_in_date).days
    results = []

    for rt in room_types:
        # Total rooms of this type
        total_q = await db.execute(
            select(func.count(Room.id)).where(
                Room.hotel_id == hotel_id,
                Room.room_type_id == rt.id,
            )
        )
        total = total_q.scalar() or 0

        # Unavailable (out of order or maintenance)
        unavailable_q = await db.execute(
            select(func.count(Room.id)).where(
                Room.hotel_id == hotel_id,
                Room.room_type_id == rt.id,
                Room.status.in_(["OUT_OF_ORDER", "MAINTENANCE"]),
            )
        )
        unavailable = unavailable_q.scalar() or 0

        # Active overlapping reservations for this room type
        reserved_q = await db.execute(
            select(func.count(Reservation.id)).where(
                Reservation.hotel_id == hotel_id,
                Reservation.room_type_id == rt.id,
                Reservation.status.in_(["CONFIRMED", "CHECKED_IN"]),
                Reservation.check_in_date < check_out_date,
                Reservation.check_out_date > check_in_date,
            )
        )
        reserved = reserved_q.scalar() or 0

        sellable = max(0, total - unavailable)
        available = max(0, sellable - reserved)

        results.append(
            AvailabilityResult(
                room_type_id=rt.id,
                room_type_name=rt.name,
                base_rate=rt.base_rate,
                total_rooms=total,
                available_rooms=available,
                unavailable_rooms=total - available,
                nights=nights,
                total_rate=rt.base_rate * nights,
            )
        )

    return results


async def find_available_room(
    db: AsyncSession,
    hotel_id: int,
    room_type_id: int,
    check_in_date: date,
    check_out_date: date,
    exclude_reservation_id: Optional[int] = None,
) -> Optional[Room]:
    """Find a specific available room of a given type for the date range."""
    # Rooms occupied by overlapping reservations
    overlap_q = select(Reservation.room_id).where(
        Reservation.hotel_id == hotel_id,
        Reservation.status.in_(["CONFIRMED", "CHECKED_IN"]),
        Reservation.room_id.is_not(None),
        Reservation.check_in_date < check_out_date,
        Reservation.check_out_date > check_in_date,
    )
    if exclude_reservation_id:
        overlap_q = overlap_q.where(Reservation.id != exclude_reservation_id)

    result = await db.execute(
        select(Room).where(
            Room.hotel_id == hotel_id,
            Room.room_type_id == room_type_id,
            Room.status.not_in(["OUT_OF_ORDER", "MAINTENANCE", "OCCUPIED"]),
            Room.id.not_in(overlap_q.scalar_subquery()),
        ).limit(1)
    )
    return result.scalar_one_or_none()

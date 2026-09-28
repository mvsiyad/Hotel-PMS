"""
Reservations CRUD + check-in / check-out endpoints.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ...db.session import get_db
from ...models.reservation import Reservation, RESERVATION_STATUS_TRANSITIONS
from ...schemas import (
    ReservationCreate, ReservationUpdate, ReservationResponse,
    CheckInRequest, CheckOutRequest,
)
from ...core.dependencies import (
    get_current_actor, get_current_staff, require_hotel_access, require_scope, require_permission
)
from ...core.permissions import IntegrationScope, Permission
from ...services.reservation_service import create_reservation, check_in, check_out
from ...services.audit_service import log_action, actor_info

router = APIRouter(prefix="/hotels/{hotel_id}/reservations", tags=["Reservations"])


@router.get("", response_model=List[ReservationResponse])
async def list_reservations(
    hotel_id: int,
    status: Optional[str] = Query(None),
    guest_id: Optional[int] = Query(None),
    check_in_date: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    actor=Depends(require_scope(IntegrationScope.READ_RESERVATIONS)),
):
    require_hotel_access(hotel_id, actor)
    q = select(Reservation).where(Reservation.hotel_id == hotel_id)
    if status:
        q = q.where(Reservation.status == status)
    if guest_id:
        q = q.where(Reservation.guest_id == guest_id)
    result = await db.execute(q.order_by(Reservation.check_in_date))
    return result.scalars().all()


@router.post("", response_model=ReservationResponse, status_code=201)
async def create_reservation_endpoint(
    hotel_id: int,
    body: ReservationCreate,
    db: AsyncSession = Depends(get_db),
    actor=Depends(require_scope(IntegrationScope.CREATE_RESERVATIONS)),
):
    require_hotel_access(hotel_id, actor)
    created_by = actor.id if hasattr(actor, "full_name") else None
    res = await create_reservation(db, hotel_id, body, created_by_id=created_by)
    return res


@router.get("/{reservation_id}", response_model=ReservationResponse)
async def get_reservation(
    hotel_id: int,
    reservation_id: int,
    db: AsyncSession = Depends(get_db),
    actor=Depends(require_scope(IntegrationScope.READ_RESERVATIONS)),
):
    require_hotel_access(hotel_id, actor)
    result = await db.execute(
        select(Reservation).where(
            Reservation.id == reservation_id,
            Reservation.hotel_id == hotel_id,
        )
    )
    res = result.scalar_one_or_none()
    if not res:
        raise HTTPException(404, "Reservation not found")
    return res


@router.get("/confirm/{confirmation_number}", response_model=ReservationResponse)
async def get_by_confirmation(
    hotel_id: int,
    confirmation_number: str,
    db: AsyncSession = Depends(get_db),
    actor=Depends(require_scope(IntegrationScope.READ_RESERVATIONS)),
):
    require_hotel_access(hotel_id, actor)
    result = await db.execute(
        select(Reservation).where(
            Reservation.confirmation_number == confirmation_number,
            Reservation.hotel_id == hotel_id,
        )
    )
    res = result.scalar_one_or_none()
    if not res:
        raise HTTPException(404, "Reservation not found")
    return res


@router.patch("/{reservation_id}", response_model=ReservationResponse)
async def update_reservation(
    hotel_id: int,
    reservation_id: int,
    body: ReservationUpdate,
    db: AsyncSession = Depends(get_db),
    actor=Depends(require_scope(IntegrationScope.MODIFY_RESERVATIONS)),
):
    require_hotel_access(hotel_id, actor)
    result = await db.execute(
        select(Reservation).where(
            Reservation.id == reservation_id, Reservation.hotel_id == hotel_id
        )
    )
    res = result.scalar_one_or_none()
    if not res:
        raise HTTPException(404, "Reservation not found")
    if res.status not in ("PENDING", "CONFIRMED"):
        raise HTTPException(400, f"Cannot modify reservation in status: {res.status}")
    updates = body.model_dump(exclude_none=True)
    for k, v in updates.items():
        setattr(res, k, v)
    # Recalculate total if dates/rate changed
    if res.check_in_date and res.check_out_date:
        nights = (res.check_out_date - res.check_in_date).days
        res.total_amount = res.rate * nights
    ai = actor_info(actor)
    await log_action(
        db, "MODIFY_RESERVATION",
        hotel_id=hotel_id, **ai,
        resource_type="reservation", resource_id=reservation_id,
        details=updates,
    )
    return res


@router.post("/{reservation_id}/check-in", response_model=ReservationResponse)
async def checkin_endpoint(
    hotel_id: int,
    reservation_id: int,
    body: CheckInRequest,
    db: AsyncSession = Depends(get_db),
    actor=Depends(require_permission(Permission.CHECK_IN)),
):
    require_hotel_access(hotel_id, actor)
    return await check_in(db, hotel_id, reservation_id, body, actor=actor)


@router.post("/{reservation_id}/check-out", response_model=ReservationResponse)
async def checkout_endpoint(
    hotel_id: int,
    reservation_id: int,
    body: CheckOutRequest,
    db: AsyncSession = Depends(get_db),
    actor=Depends(require_permission(Permission.CHECK_OUT)),
):
    require_hotel_access(hotel_id, actor)
    return await check_out(db, hotel_id, reservation_id, body, actor=actor)


@router.post("/{reservation_id}/cancel", response_model=ReservationResponse)
async def cancel_reservation(
    hotel_id: int,
    reservation_id: int,
    db: AsyncSession = Depends(get_db),
    actor=Depends(require_scope(IntegrationScope.CANCEL_RESERVATIONS)),
):
    require_hotel_access(hotel_id, actor)
    result = await db.execute(
        select(Reservation).where(
            Reservation.id == reservation_id, Reservation.hotel_id == hotel_id
        )
    )
    res = result.scalar_one_or_none()
    if not res:
        raise HTTPException(404, "Reservation not found")
    allowed = RESERVATION_STATUS_TRANSITIONS.get(res.status, [])
    if "CANCELLED" not in allowed:
        raise HTTPException(400, f"Cannot cancel reservation in status: {res.status}")
    res.status = "CANCELLED"
    # Free the room if assigned
    if res.room_id:
        from ...models.room import Room, transition_room
        room_result = await db.execute(select(Room).where(Room.id == res.room_id))
        room = room_result.scalar_one_or_none()
        if room and room.status == "RESERVED":
            transition_room(room, "AVAILABLE")
    ai = actor_info(actor)
    await log_action(
        db, "CANCEL_RESERVATION",
        hotel_id=hotel_id, **ai,
        resource_type="reservation", resource_id=reservation_id,
    )
    return res


@router.post("/{reservation_id}/no-show", response_model=ReservationResponse)
async def no_show(
    hotel_id: int,
    reservation_id: int,
    db: AsyncSession = Depends(get_db),
    actor=Depends(require_permission(Permission.MODIFY_RESERVATIONS)),
):
    require_hotel_access(hotel_id, actor)
    result = await db.execute(
        select(Reservation).where(
            Reservation.id == reservation_id, Reservation.hotel_id == hotel_id
        )
    )
    res = result.scalar_one_or_none()
    if not res:
        raise HTTPException(404, "Reservation not found")
    if res.status != "CONFIRMED":
        raise HTTPException(400, f"Cannot mark no-show: reservation status is {res.status}")
    res.status = "NO_SHOW"
    await log_action(
        db, "NO_SHOW",
        hotel_id=hotel_id, actor_type="STAFF", actor_id=actor.id, actor_name=actor.full_name,
        resource_type="reservation", resource_id=reservation_id,
    )
    return res

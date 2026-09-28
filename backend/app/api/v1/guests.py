"""
Guests CRUD endpoints.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from ...db.session import get_db
from ...models.guest import Guest
from ...schemas import GuestCreate, GuestUpdate, GuestResponse
from ...core.dependencies import get_current_actor, require_hotel_access, require_scope
from ...core.permissions import IntegrationScope
from ...services.audit_service import log_action

router = APIRouter(prefix="/hotels/{hotel_id}/guests", tags=["Guests"])


@router.get("", response_model=List[GuestResponse])
async def list_guests(
    hotel_id: int,
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    actor=Depends(require_scope(IntegrationScope.READ_GUESTS)),
):
    require_hotel_access(hotel_id, actor)
    q = select(Guest).where(Guest.hotel_id == hotel_id)
    if search:
        term = f"%{search}%"
        q = q.where(
            or_(
                Guest.first_name.ilike(term),
                Guest.last_name.ilike(term),
                Guest.email.ilike(term),
                Guest.phone.ilike(term),
            )
        )
    result = await db.execute(q.order_by(Guest.last_name))
    return result.scalars().all()


@router.post("", response_model=GuestResponse, status_code=201)
async def create_guest(
    hotel_id: int,
    body: GuestCreate,
    db: AsyncSession = Depends(get_db),
    actor=Depends(require_scope(IntegrationScope.CREATE_GUESTS)),
):
    require_hotel_access(hotel_id, actor)
    guest = Guest(hotel_id=hotel_id, **body.model_dump())
    db.add(guest)
    await db.flush()
    await log_action(
        db, "CREATE_GUEST",
        hotel_id=hotel_id,
        actor_type="STAFF" if hasattr(actor, "full_name") else "INTEGRATION",
        actor_id=actor.id,
        actor_name=getattr(actor, "full_name", getattr(actor, "name", "Unknown")),
        resource_type="guest", resource_id=guest.id,
        details={"name": f"{guest.first_name} {guest.last_name}"},
    )
    return guest


@router.get("/{guest_id}", response_model=GuestResponse)
async def get_guest(
    hotel_id: int,
    guest_id: int,
    db: AsyncSession = Depends(get_db),
    actor=Depends(require_scope(IntegrationScope.READ_GUESTS)),
):
    require_hotel_access(hotel_id, actor)
    result = await db.execute(
        select(Guest).where(Guest.id == guest_id, Guest.hotel_id == hotel_id)
    )
    guest = result.scalar_one_or_none()
    if not guest:
        raise HTTPException(404, "Guest not found")
    return guest


@router.patch("/{guest_id}", response_model=GuestResponse)
async def update_guest(
    hotel_id: int,
    guest_id: int,
    body: GuestUpdate,
    db: AsyncSession = Depends(get_db),
    actor=Depends(require_scope(IntegrationScope.UPDATE_GUESTS)),
):
    require_hotel_access(hotel_id, actor)
    result = await db.execute(
        select(Guest).where(Guest.id == guest_id, Guest.hotel_id == hotel_id)
    )
    guest = result.scalar_one_or_none()
    if not guest:
        raise HTTPException(404, "Guest not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(guest, k, v)
    return guest

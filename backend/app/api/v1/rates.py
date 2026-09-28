"""
Rates endpoint — reads from actual room type base rates in DB.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ...db.session import get_db
from ...models.room_type import RoomType
from ...models.hotel import Hotel
from ...schemas import RateResponse
from ...core.dependencies import get_current_actor, require_hotel_access, require_scope
from ...core.permissions import IntegrationScope

router = APIRouter(prefix="/hotels/{hotel_id}/rates", tags=["Rates"])


@router.get("", response_model=List[RateResponse])
async def get_rates(
    hotel_id: int,
    room_type_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    actor=Depends(require_scope(IntegrationScope.READ_RATES)),
):
    """Return current base rates from the PMS database. Never hardcoded."""
    require_hotel_access(hotel_id, actor)

    # Get hotel for currency
    hotel_result = await db.execute(select(Hotel).where(Hotel.id == hotel_id))
    hotel = hotel_result.scalar_one_or_none()
    currency = hotel.currency if hotel else "USD"

    q = select(RoomType).where(
        RoomType.hotel_id == hotel_id,
        RoomType.status == "ACTIVE",
    )
    if room_type_id:
        q = q.where(RoomType.id == room_type_id)

    result = await db.execute(q)
    room_types = result.scalars().all()

    return [
        RateResponse(
            room_type_id=rt.id,
            room_type_name=rt.name,
            base_rate=rt.base_rate,
            currency=currency,
        )
        for rt in room_types
    ]

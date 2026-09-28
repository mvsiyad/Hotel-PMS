"""
Availability endpoint — real-time calculation from DB state.
"""

from datetime import date
from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.session import get_db
from ...schemas import AvailabilityResult
from ...core.dependencies import get_current_actor, require_hotel_access, require_scope
from ...core.permissions import IntegrationScope
from ...services.availability_service import calculate_availability

router = APIRouter(prefix="/hotels/{hotel_id}/availability", tags=["Availability"])


@router.get("", response_model=List[AvailabilityResult])
async def get_availability(
    hotel_id: int,
    check_in_date: date = Query(...),
    check_out_date: date = Query(...),
    room_type_id: Optional[int] = Query(None),
    adults: int = Query(1),
    children: int = Query(0),
    db: AsyncSession = Depends(get_db),
    actor=Depends(require_scope(IntegrationScope.READ_AVAILABILITY)),
):
    """
    Real-time room availability for a date range.
    Calculated from actual reservation and room state — never hardcoded.
    """
    require_hotel_access(hotel_id, actor)

    if check_out_date <= check_in_date:
        from fastapi import HTTPException
        raise HTTPException(400, "check_out_date must be after check_in_date")

    return await calculate_availability(
        db, hotel_id, check_in_date, check_out_date, room_type_id
    )

"""
Developer/testing tools — clearly separated from operational workflows.
PMS Admin only.
"""

import traceback
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ...db.session import get_db
from ...core.dependencies import get_current_admin
from ...models.hotel import Hotel
from ...services.seed_service import seed_demo_data

router = APIRouter(prefix="/dev", tags=["Developer Tools (Admin Only)"])


@router.post("/seed/{hotel_id}")
async def seed_hotel(
    hotel_id: int,
    db: AsyncSession = Depends(get_db),
    actor=Depends(get_current_admin),
):
    """
    Seed realistic demo data for a hotel.
    Creates room types, rooms, staff, guests, reservations, and menu items.
    This is a testing tool — NOT for production use.
    """
    result = await db.execute(select(Hotel).where(Hotel.id == hotel_id))
    if not result.scalar_one_or_none():
        raise HTTPException(404, "Hotel not found")

    try:
        summary = await seed_demo_data(db, hotel_id)
        return {"message": "Seed completed", "created": summary}
    except Exception as e:
        tb = traceback.format_exc()
        raise HTTPException(500, detail=f"Seed failed: {str(e)}\n\nTraceback:\n{tb}")


@router.get("/health")
async def health_check():
    """Simple health check endpoint."""
    return {"status": "ok", "service": "Hotel PMS API", "version": "1.0.0"}

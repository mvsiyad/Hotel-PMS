"""
API v1 router — aggregates all sub-routers.
"""

from fastapi import APIRouter
from .auth import router as auth_router
from .hotels import router as hotels_router
from .room_types import router as room_types_router
from .rooms import router as rooms_router
from .guests import router as guests_router
from .reservations import router as reservations_router
from .housekeeping import router as housekeeping_router
from .maintenance import router as maintenance_router
from .room_service import router as room_service_router
from .staff import router as staff_router
from .integrations import router as integrations_router
from .availability import router as availability_router
from .rates import router as rates_router
from .audit import router as audit_router
from .webhooks import router as webhooks_router
from .seed import router as seed_router

v1_router = APIRouter(prefix="/api/v1")

v1_router.include_router(auth_router)
v1_router.include_router(hotels_router)
v1_router.include_router(room_types_router)
v1_router.include_router(rooms_router)
v1_router.include_router(guests_router)
v1_router.include_router(reservations_router)
v1_router.include_router(housekeeping_router)
v1_router.include_router(maintenance_router)
v1_router.include_router(room_service_router)
v1_router.include_router(staff_router)
v1_router.include_router(integrations_router)
v1_router.include_router(availability_router)
v1_router.include_router(rates_router)
v1_router.include_router(audit_router)
v1_router.include_router(webhooks_router)
v1_router.include_router(seed_router)

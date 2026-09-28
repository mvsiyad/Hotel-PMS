"""
Hotel PMS — FastAPI Application Entry Point.
"""

import traceback
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import select

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

from .core.config import settings
from .core.security import get_password_hash
from .core.permissions import get_default_permissions, StaffRole
from .db.session import init_db, AsyncSessionLocal
from .models import Hotel, Staff
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
from .core.limiter import limiter
from .api.v1 import v1_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Bootstrap: create DB tables + first admin + default hotel on startup."""
    await init_db()
    await _bootstrap()
    yield


async def _bootstrap():
    """Create the default hotel and PMS Admin if they don't exist."""
    async with AsyncSessionLocal() as db:
        try:
            # Check for existing admin
            result = await db.execute(
                select(Staff).where(Staff.email == settings.FIRST_ADMIN_EMAIL)
            )
            if result.scalar_one_or_none():
                return  # Already bootstrapped

            # Create default hotel
            hotel = Hotel(
                name=settings.FIRST_HOTEL_NAME,
                address=settings.FIRST_HOTEL_ADDRESS,
                phone=settings.FIRST_HOTEL_PHONE,
                email=settings.FIRST_HOTEL_EMAIL,
                timezone=settings.FIRST_HOTEL_TIMEZONE,
                currency=settings.FIRST_HOTEL_CURRENCY,
                status="ACTIVE",
            )
            db.add(hotel)
            await db.flush()

            # Create PMS Admin (no hotel restriction)
            admin = Staff(
                hotel_id=None,  # PMS Admin is cross-property
                first_name=settings.FIRST_ADMIN_FIRST_NAME,
                last_name=settings.FIRST_ADMIN_LAST_NAME,
                email=settings.FIRST_ADMIN_EMAIL,
                hashed_password=get_password_hash(settings.FIRST_ADMIN_PASSWORD),
                role="PMS_ADMIN",
            )
            admin.permissions_list = get_default_permissions(StaffRole.PMS_ADMIN)
            db.add(admin)
            await db.commit()
            print(f"✅ PMS bootstrapped: hotel '{hotel.name}' + admin '{admin.email}'")
        except Exception as e:
            await db.rollback()
            print(f"⚠️  Bootstrap error (may be harmless if already seeded): {e}")


app = FastAPI(
    title="Hotel PMS API",
    description="""
# Hotel Property Management System API

A standalone, realistic Hotel PMS simulator.
Designed for integration testing with the Hotel AI Platform.

## Authentication

### Staff (JWT)
POST `/api/v1/auth/login` with email + password → returns `access_token`

### Integration (Client Credentials)
POST `/api/v1/integrations/token` with `client_id` + `client_secret` → scoped `access_token`

## Integration Scopes
See the Integrations section for available scopes.
    """,
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API
app.include_router(v1_router)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Catch-all handler — logs the full traceback to the server console
    and returns a readable JSON error so the frontend can show the real issue.
    """
    tb = traceback.format_exc()
    logger.error("❌ Unhandled exception on %s %s:\n%s", request.method, request.url.path, tb)
    return JSONResponse(
        status_code=500,
        content={
            "detail": str(exc),
            "type": type(exc).__name__,
            # Include traceback only when DEBUG=True (never in production)
            **({"traceback": tb} if settings.DEBUG else {}),
        },
    )


@app.get("/", tags=["Health"])
async def root():
    return {
        "service": "Hotel PMS API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/api/v1/dev/health",
    }

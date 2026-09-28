"""
Staff authentication endpoints.
"""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ...db.session import get_db
from ...models.staff import Staff
from ...core.security import verify_password, create_access_token
from ...core.dependencies import get_current_staff
from ...core.limiter import limiter
from ...core.config import settings
from ...schemas import LoginRequest, TokenResponse
from ...services.audit_service import log_action


router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
@limiter.limit(settings.LOGIN_RATE_LIMIT)
async def login(
    request: Request,
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """Authenticate a staff member and return a JWT."""
    result = await db.execute(select(Staff).where(Staff.email == body.email))
    staff = result.scalar_one_or_none()

    if not staff or not verify_password(body.password, staff.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not staff.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled. Contact your PMS administrator.",
        )

    # Update last login
    staff.last_login_at = datetime.utcnow()

    token = create_access_token(
        data={
            "sub": str(staff.id),
            "hotel_id": staff.hotel_id,
            "role": staff.role,
        }
    )

    await log_action(
        db,
        "STAFF_LOGIN",
        hotel_id=staff.hotel_id,
        actor_type="STAFF",
        actor_id=staff.id,
        actor_name=staff.full_name,
        resource_type="staff",
        resource_id=staff.id,
        ip_address=request.client.host if request.client else None,
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        staff_id=staff.id,
        role=staff.role,
        hotel_id=staff.hotel_id,
        permissions=staff.permissions_list,
    )


@router.get("/me")
async def get_me(
    db: AsyncSession = Depends(get_db),
    actor=Depends(get_current_staff),
):
    """Get current logged-in staff info."""
    return {
        "id": actor.id,
        "hotel_id": actor.hotel_id,
        "name": actor.full_name,
        "email": actor.email,
        "role": actor.role,
        "permissions": actor.permissions,
    }

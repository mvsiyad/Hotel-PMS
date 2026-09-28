"""
FastAPI dependency injection: current user / integration resolver,
permission + scope enforcement.
"""

from typing import Annotated, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from .security import decode_token
from .permissions import Permission, IntegrationScope, has_permission
from ..db.session import get_db

security = HTTPBearer(auto_error=False)

# ─────────────────────────────────────────────────────────────────────────────
# Token resolution
# ─────────────────────────────────────────────────────────────────────────────

class CurrentStaff:
    def __init__(
        self,
        id: int,
        hotel_id: Optional[int],
        email: str,
        first_name: str,
        last_name: str,
        role: str,
        permissions: list[str],
        is_active: bool,
    ):
        self.id = id
        self.hotel_id = hotel_id
        self.email = email
        self.first_name = first_name
        self.last_name = last_name
        self.role = role
        self.permissions = permissions
        self.is_active = is_active

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"


class CurrentIntegration:
    def __init__(
        self,
        id: int,
        hotel_id: int,
        name: str,
        scopes: list[str],
    ):
        self.id = id
        self.hotel_id = hotel_id
        self.name = name
        self.scopes = scopes


async def get_current_actor(
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(security)],
    db: AsyncSession = Depends(get_db),
) -> "CurrentStaff | CurrentIntegration":
    """
    Decode JWT and return either CurrentStaff or CurrentIntegration.
    Raises 401 if token is invalid/missing.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization token required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = decode_token(credentials.credentials)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token_type = payload.get("token_type")

    if token_type == "staff":
        return await _resolve_staff(payload, db)
    elif token_type == "integration":
        return await _resolve_integration(payload, db)
    else:
        raise HTTPException(status_code=401, detail="Unknown token type")


async def _resolve_staff(payload: dict, db: AsyncSession) -> CurrentStaff:
    from ..models.staff import Staff

    staff_id = payload.get("sub")
    if not staff_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    result = await db.execute(select(Staff).where(Staff.id == int(staff_id)))
    staff = result.scalar_one_or_none()

    if not staff:
        raise HTTPException(status_code=401, detail="Staff not found")
    if not staff.is_active:
        raise HTTPException(status_code=403, detail="Staff account is disabled")

    return CurrentStaff(
        id=staff.id,
        hotel_id=staff.hotel_id,
        email=staff.email,
        first_name=staff.first_name,
        last_name=staff.last_name,
        role=staff.role,
        permissions=staff.permissions_list,
        is_active=staff.is_active,
    )


async def _resolve_integration(payload: dict, db: AsyncSession) -> CurrentIntegration:
    from ..models.integration import Integration

    integration_id = payload.get("sub")
    if not integration_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    result = await db.execute(
        select(Integration).where(Integration.id == int(integration_id))
    )
    integration = result.scalar_one_or_none()

    if not integration:
        raise HTTPException(status_code=401, detail="Integration not found")
    if integration.status != "ACTIVE":
        raise HTTPException(status_code=403, detail="Integration is disabled or revoked")

    return CurrentIntegration(
        id=integration.id,
        hotel_id=integration.hotel_id,
        name=integration.name,
        scopes=integration.scopes_list,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Staff-only dependency
# ─────────────────────────────────────────────────────────────────────────────

async def get_current_staff(
    actor: Annotated["CurrentStaff | CurrentIntegration", Depends(get_current_actor)],
) -> CurrentStaff:
    if not isinstance(actor, CurrentStaff):
        raise HTTPException(
            status_code=403,
            detail="This endpoint requires staff authentication",
        )
    return actor


async def get_current_admin(
    staff: Annotated[CurrentStaff, Depends(get_current_staff)],
) -> CurrentStaff:
    if staff.role != "PMS_ADMIN":
        raise HTTPException(
            status_code=403, detail="PMS Admin access required"
        )
    return staff


# ─────────────────────────────────────────────────────────────────────────────
# Permission enforcement factories
# ─────────────────────────────────────────────────────────────────────────────

def require_permission(perm: Permission):
    """Dependency factory: raises 403 if staff lacks the permission."""

    async def _check(
        staff: Annotated[CurrentStaff, Depends(get_current_staff)],
    ) -> CurrentStaff:
        if not has_permission(staff.permissions, perm):
            raise HTTPException(
                status_code=403,
                detail=f"Permission denied: {perm.value}",
            )
        return staff

    return _check


def require_scope(scope: IntegrationScope):
    """Dependency factory: raises 403 if integration lacks the scope."""

    async def _check(
        actor: Annotated[
            "CurrentStaff | CurrentIntegration", Depends(get_current_actor)
        ],
    ) -> "CurrentStaff | CurrentIntegration":
        if isinstance(actor, CurrentIntegration):
            if scope.value not in actor.scopes:
                raise HTTPException(
                    status_code=403,
                    detail=f"Integration missing required scope: {scope.value}",
                )
        elif isinstance(actor, CurrentStaff):
            # Map integration scope to staff permission where applicable
            _scope_to_perm = {
                IntegrationScope.READ_ROOMS: Permission.VIEW_ROOMS,
                IntegrationScope.READ_ROOM_TYPES: Permission.VIEW_ROOMS,
                IntegrationScope.READ_AVAILABILITY: Permission.VIEW_AVAILABILITY,
                IntegrationScope.READ_RATES: Permission.VIEW_RATES,
                IntegrationScope.READ_RESERVATIONS: Permission.VIEW_RESERVATIONS,
                IntegrationScope.CREATE_RESERVATIONS: Permission.CREATE_RESERVATIONS,
                IntegrationScope.MODIFY_RESERVATIONS: Permission.MODIFY_RESERVATIONS,
                IntegrationScope.CANCEL_RESERVATIONS: Permission.CANCEL_RESERVATIONS,
                IntegrationScope.READ_GUESTS: Permission.VIEW_GUESTS,
                IntegrationScope.CREATE_GUESTS: Permission.MANAGE_GUESTS,
                IntegrationScope.UPDATE_GUESTS: Permission.MANAGE_GUESTS,
                IntegrationScope.READ_HOUSEKEEPING: Permission.VIEW_HOUSEKEEPING,
                IntegrationScope.CREATE_HOUSEKEEPING_REQUEST: Permission.MANAGE_HOUSEKEEPING,
                IntegrationScope.UPDATE_HOUSEKEEPING: Permission.MANAGE_HOUSEKEEPING,
            }
            perm = _scope_to_perm.get(scope)
            if perm:
                if not has_permission(actor.permissions, perm):
                    raise HTTPException(
                        status_code=403,
                        detail=f"Permission denied: {perm.value}",
                    )
            else:
                # Unmapped scope → deny staff by default (safe fallback)
                raise HTTPException(
                    status_code=403,
                    detail=f"Staff access not configured for scope: {scope.value}",
                )
        return actor

    return _check


# ─────────────────────────────────────────────────────────────────────────────
# Hotel isolation guard
# ─────────────────────────────────────────────────────────────────────────────

def require_hotel_access(hotel_id: int, actor: "CurrentStaff | CurrentIntegration"):
    """
    Ensures the actor can only access resources from their own hotel.
    PMS Admin (hotel_id=None) can access any hotel.
    """
    if isinstance(actor, CurrentStaff):
        if actor.role == "PMS_ADMIN":
            return  # Admins have cross-hotel access
        if actor.hotel_id != hotel_id:
            raise HTTPException(
                status_code=403,
                detail="Cross-property access denied",
            )
    elif isinstance(actor, CurrentIntegration):
        if actor.hotel_id != hotel_id:
            raise HTTPException(
                status_code=403,
                detail="Integration does not have access to this hotel",
            )

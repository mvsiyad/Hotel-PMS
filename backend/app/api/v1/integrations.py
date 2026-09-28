"""
Integration (API access) management endpoints.
client_secret is shown ONCE at creation and never returned again.
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime

from ...db.session import get_db
from ...models.integration import Integration
from ...schemas import (
    IntegrationCreate, IntegrationUpdate, IntegrationResponse,
    IntegrationCreateResponse, IntegrationTokenRequest, IntegrationTokenResponse,
)
from ...core.dependencies import get_current_admin, get_current_actor, require_hotel_access
from ...core.security import (
    generate_client_id, generate_client_secret,
    verify_client_secret, create_integration_token,
)
from ...core.permissions import ALL_INTEGRATION_SCOPES
from ...services.audit_service import log_action

router = APIRouter(tags=["Integrations"])

# ── Token endpoint (no auth required — uses client credentials) ───────────────

@router.post("/integrations/token", response_model=IntegrationTokenResponse)
async def get_integration_token(
    body: IntegrationTokenRequest,
    db: AsyncSession = Depends(get_db),
):
    """Exchange client_id + client_secret for a scoped integration JWT."""
    result = await db.execute(
        select(Integration).where(Integration.client_id == body.client_id)
    )
    integration = result.scalar_one_or_none()

    if not integration or not verify_client_secret(body.client_secret, integration.client_secret_hash):
        raise HTTPException(401, "Invalid client credentials")

    if integration.status != "ACTIVE":
        raise HTTPException(403, "Integration is disabled or revoked")

    integration.last_used_at = datetime.utcnow()

    token = create_integration_token(
        integration_id=integration.id,
        hotel_id=integration.hotel_id,
        scopes=integration.scopes_list,
    )

    return IntegrationTokenResponse(
        access_token=token,
        token_type="bearer",
        integration_id=integration.id,
        hotel_id=integration.hotel_id,
        scopes=integration.scopes_list,
    )


# ── CRUD (PMS Admin only) ─────────────────────────────────────────────────────

hotel_router = APIRouter(prefix="/hotels/{hotel_id}/integrations")


@hotel_router.get("", response_model=List[IntegrationResponse])
async def list_integrations(
    hotel_id: int,
    db: AsyncSession = Depends(get_db),
    actor=Depends(get_current_admin),
):
    require_hotel_access(hotel_id, actor)
    result = await db.execute(
        select(Integration).where(Integration.hotel_id == hotel_id)
    )
    return result.scalars().all()


@hotel_router.post("", response_model=IntegrationCreateResponse, status_code=201)
async def create_integration(
    hotel_id: int,
    body: IntegrationCreate,
    db: AsyncSession = Depends(get_db),
    actor=Depends(get_current_admin),
):
    require_hotel_access(hotel_id, actor)

    # Validate scopes
    for scope in body.scopes:
        if scope not in ALL_INTEGRATION_SCOPES:
            raise HTTPException(400, f"Unknown scope: {scope}")

    plain_secret, hashed_secret = generate_client_secret()
    client_id = generate_client_id()

    integration = Integration(
        hotel_id=hotel_id,
        name=body.name,
        description=body.description,
        client_id=client_id,
        client_secret_hash=hashed_secret,
        created_by_id=actor.id,
    )
    integration.scopes_list = body.scopes
    db.add(integration)
    await db.flush()

    await log_action(
        db, "CREATE_INTEGRATION",
        hotel_id=hotel_id, actor_type="STAFF", actor_id=actor.id, actor_name=actor.full_name,
        resource_type="integration", resource_id=integration.id,
        details={"name": body.name, "scopes": body.scopes},
    )

    # Return response with plain_secret (ONE TIME ONLY)
    return IntegrationCreateResponse(
        id=integration.id,
        hotel_id=integration.hotel_id,
        name=integration.name,
        description=integration.description,
        client_id=integration.client_id,
        client_secret=plain_secret,  # shown once
        scopes_json=integration.scopes_json,
        status=integration.status,
        last_used_at=integration.last_used_at,
        created_at=integration.created_at,
        updated_at=integration.updated_at,
    )


@hotel_router.patch("/{integration_id}", response_model=IntegrationResponse)
async def update_integration(
    hotel_id: int,
    integration_id: int,
    body: IntegrationUpdate,
    db: AsyncSession = Depends(get_db),
    actor=Depends(get_current_admin),
):
    require_hotel_access(hotel_id, actor)
    result = await db.execute(
        select(Integration).where(
            Integration.id == integration_id, Integration.hotel_id == hotel_id
        )
    )
    integration = result.scalar_one_or_none()
    if not integration:
        raise HTTPException(404, "Integration not found")

    updates = body.model_dump(exclude_none=True)
    if "scopes" in updates:
        for s in updates["scopes"]:
            if s not in ALL_INTEGRATION_SCOPES:
                raise HTTPException(400, f"Unknown scope: {s}")
        integration.scopes_list = updates.pop("scopes")

    for k, v in updates.items():
        setattr(integration, k, v)

    await log_action(
        db, "UPDATE_INTEGRATION",
        hotel_id=hotel_id, actor_type="STAFF", actor_id=actor.id, actor_name=actor.full_name,
        resource_type="integration", resource_id=integration_id,
        details=updates,
    )
    return integration


@hotel_router.post("/{integration_id}/rotate", response_model=IntegrationCreateResponse)
async def rotate_secret(
    hotel_id: int,
    integration_id: int,
    db: AsyncSession = Depends(get_db),
    actor=Depends(get_current_admin),
):
    """Rotate the client secret — returns new secret ONCE."""
    require_hotel_access(hotel_id, actor)
    result = await db.execute(
        select(Integration).where(
            Integration.id == integration_id, Integration.hotel_id == hotel_id
        )
    )
    integration = result.scalar_one_or_none()
    if not integration:
        raise HTTPException(404, "Integration not found")

    plain_secret, hashed_secret = generate_client_secret()
    integration.client_secret_hash = hashed_secret

    await log_action(
        db, "ROTATE_INTEGRATION_SECRET",
        hotel_id=hotel_id, actor_type="STAFF", actor_id=actor.id, actor_name=actor.full_name,
        resource_type="integration", resource_id=integration_id,
    )

    return IntegrationCreateResponse(
        id=integration.id,
        hotel_id=integration.hotel_id,
        name=integration.name,
        description=integration.description,
        client_id=integration.client_id,
        client_secret=plain_secret,
        scopes_json=integration.scopes_json,
        status=integration.status,
        last_used_at=integration.last_used_at,
        created_at=integration.created_at,
        updated_at=integration.updated_at,
    )


@hotel_router.delete("/{integration_id}/revoke")
async def revoke_integration(
    hotel_id: int,
    integration_id: int,
    db: AsyncSession = Depends(get_db),
    actor=Depends(get_current_admin),
):
    require_hotel_access(hotel_id, actor)
    result = await db.execute(
        select(Integration).where(
            Integration.id == integration_id, Integration.hotel_id == hotel_id
        )
    )
    integration = result.scalar_one_or_none()
    if not integration:
        raise HTTPException(404, "Integration not found")

    integration.status = "REVOKED"
    await log_action(
        db, "REVOKE_INTEGRATION",
        hotel_id=hotel_id, actor_type="STAFF", actor_id=actor.id, actor_name=actor.full_name,
        resource_type="integration", resource_id=integration_id,
    )
    return {"message": "Integration revoked"}


router.include_router(hotel_router)

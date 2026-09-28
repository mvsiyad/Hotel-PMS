"""
Webhooks CRUD — developers can register URLs for PMS events.
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ...db.session import get_db
from ...models.webhook import Webhook, WEBHOOK_EVENTS
from ...schemas import WebhookCreate, WebhookUpdate, WebhookResponse
from ...core.dependencies import get_current_admin, require_hotel_access

router = APIRouter(prefix="/hotels/{hotel_id}/webhooks", tags=["Webhooks"])


@router.get("", response_model=List[WebhookResponse])
async def list_webhooks(
    hotel_id: int,
    db: AsyncSession = Depends(get_db),
    actor=Depends(get_current_admin),
):
    require_hotel_access(hotel_id, actor)
    result = await db.execute(select(Webhook).where(Webhook.hotel_id == hotel_id))
    return result.scalars().all()


@router.get("/events")
async def list_webhook_events():
    """List all supported webhook event types."""
    return {"events": WEBHOOK_EVENTS}


@router.post("", response_model=WebhookResponse, status_code=201)
async def create_webhook(
    hotel_id: int,
    body: WebhookCreate,
    db: AsyncSession = Depends(get_db),
    actor=Depends(get_current_admin),
):
    require_hotel_access(hotel_id, actor)
    for event in body.events:
        if event not in WEBHOOK_EVENTS:
            raise HTTPException(400, f"Unknown webhook event: {event}")

    wh = Webhook(hotel_id=hotel_id, name=body.name, url=body.url, secret=body.secret)
    wh.events_list = body.events
    db.add(wh)
    await db.flush()
    return wh


@router.patch("/{webhook_id}", response_model=WebhookResponse)
async def update_webhook(
    hotel_id: int,
    webhook_id: int,
    body: WebhookUpdate,
    db: AsyncSession = Depends(get_db),
    actor=Depends(get_current_admin),
):
    require_hotel_access(hotel_id, actor)
    result = await db.execute(
        select(Webhook).where(Webhook.id == webhook_id, Webhook.hotel_id == hotel_id)
    )
    wh = result.scalar_one_or_none()
    if not wh:
        raise HTTPException(404, "Webhook not found")
    updates = body.model_dump(exclude_none=True)
    if "events" in updates:
        wh.events_list = updates.pop("events")
    for k, v in updates.items():
        setattr(wh, k, v)
    return wh


@router.delete("/{webhook_id}")
async def delete_webhook(
    hotel_id: int,
    webhook_id: int,
    db: AsyncSession = Depends(get_db),
    actor=Depends(get_current_admin),
):
    require_hotel_access(hotel_id, actor)
    result = await db.execute(
        select(Webhook).where(Webhook.id == webhook_id, Webhook.hotel_id == hotel_id)
    )
    wh = result.scalar_one_or_none()
    if not wh:
        raise HTTPException(404, "Webhook not found")
    await db.delete(wh)
    return {"message": "Webhook deleted"}

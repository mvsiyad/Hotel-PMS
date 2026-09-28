"""
Audit log read endpoint.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ...db.session import get_db
from ...models.audit_log import AuditLog
from ...schemas import AuditLogResponse
from ...core.dependencies import get_current_staff, require_hotel_access, require_permission
from ...core.permissions import Permission

router = APIRouter(prefix="/hotels/{hotel_id}/audit-logs", tags=["Audit Logs"])


@router.get("", response_model=List[AuditLogResponse])
async def list_audit_logs(
    hotel_id: int,
    action: Optional[str] = Query(None),
    actor_type: Optional[str] = Query(None),
    resource_type: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    db: AsyncSession = Depends(get_db),
    actor=Depends(require_permission(Permission.VIEW_AUDIT_LOGS)),
):
    require_hotel_access(hotel_id, actor)
    q = select(AuditLog).where(AuditLog.hotel_id == hotel_id)
    if action:
        q = q.where(AuditLog.action == action)
    if actor_type:
        q = q.where(AuditLog.actor_type == actor_type)
    if resource_type:
        q = q.where(AuditLog.resource_type == resource_type)
    result = await db.execute(q.order_by(AuditLog.created_at.desc()).limit(limit))
    return result.scalars().all()

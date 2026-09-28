"""
Audit logging service.
Records all significant PMS actions with actor info.
"""

import json
from typing import Optional, TYPE_CHECKING
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.audit_log import AuditLog

if TYPE_CHECKING:
    from ..core.dependencies import CurrentStaff, CurrentIntegration


async def log_action(
    db: AsyncSession,
    action: str,
    *,
    hotel_id: Optional[int] = None,
    actor_type: str = "SYSTEM",
    actor_id: Optional[int] = None,
    actor_name: str = "System",
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    details: Optional[dict] = None,
    ip_address: Optional[str] = None,
):
    """Create an audit log entry."""
    log = AuditLog(
        hotel_id=hotel_id,
        actor_type=actor_type,
        actor_id=actor_id,
        actor_name=actor_name,
        action=action,
        resource_type=resource_type,
        resource_id=str(resource_id) if resource_id is not None else None,
        details_json=json.dumps(details or {}, default=str),
        ip_address=ip_address,
    )
    db.add(log)
    # Don't commit here — caller owns the transaction


def actor_info(actor) -> dict:
    """Extract audit-log-friendly actor fields from a dependency-resolved actor."""
    from ..core.dependencies import CurrentStaff, CurrentIntegration

    if isinstance(actor, CurrentStaff):
        return {
            "actor_type": "STAFF",
            "actor_id": actor.id,
            "actor_name": actor.full_name,
        }
    elif isinstance(actor, CurrentIntegration):
        return {
            "actor_type": "INTEGRATION",
            "actor_id": actor.id,
            "actor_name": actor.name,
        }
    else:
        return {"actor_type": "SYSTEM", "actor_id": None, "actor_name": "System"}

"""
Maintenance issues CRUD.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime

from ...db.session import get_db
from ...models.maintenance import MaintenanceIssue, MAINTENANCE_STATUS_TRANSITIONS
from ...models.room import Room, transition_room
from ...schemas import MaintenanceCreate, MaintenanceUpdate, MaintenanceResponse
from ...core.dependencies import get_current_staff, require_hotel_access, require_permission
from ...core.permissions import Permission
from ...services.audit_service import log_action

router = APIRouter(prefix="/hotels/{hotel_id}/maintenance", tags=["Maintenance"])


@router.get("", response_model=List[MaintenanceResponse])
async def list_issues(
    hotel_id: int,
    status: Optional[str] = Query(None),
    room_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    actor=Depends(require_permission(Permission.VIEW_MAINTENANCE)),
):
    require_hotel_access(hotel_id, actor)
    q = select(MaintenanceIssue).where(MaintenanceIssue.hotel_id == hotel_id)
    if status:
        q = q.where(MaintenanceIssue.status == status)
    if room_id:
        q = q.where(MaintenanceIssue.room_id == room_id)
    result = await db.execute(q.order_by(MaintenanceIssue.created_at.desc()))
    return result.scalars().all()


@router.post("", response_model=MaintenanceResponse, status_code=201)
async def create_issue(
    hotel_id: int,
    body: MaintenanceCreate,
    db: AsyncSession = Depends(get_db),
    actor=Depends(require_permission(Permission.MANAGE_MAINTENANCE)),
):
    require_hotel_access(hotel_id, actor)
    issue = MaintenanceIssue(
        hotel_id=hotel_id,
        room_id=body.room_id,
        reported_by_id=actor.id,
        title=body.title,
        description=body.description,
        priority=body.priority,
        assigned_staff_id=body.assigned_staff_id,
        status="ASSIGNED" if body.assigned_staff_id else "OPEN",
        mark_room_out_of_order=str(body.mark_room_out_of_order).lower(),
    )
    db.add(issue)
    await db.flush()

    # Optionally mark room OUT_OF_ORDER
    if body.mark_room_out_of_order and body.room_id:
        room_result = await db.execute(
            select(Room).where(Room.id == body.room_id, Room.hotel_id == hotel_id)
        )
        room = room_result.scalar_one_or_none()
        if room:
            transition_room(room, "OUT_OF_ORDER")

    await log_action(
        db, "CREATE_MAINTENANCE",
        hotel_id=hotel_id, actor_type="STAFF", actor_id=actor.id, actor_name=actor.full_name,
        resource_type="maintenance_issue", resource_id=issue.id,
        details={"title": body.title, "room_id": body.room_id},
    )
    return issue


@router.get("/{issue_id}", response_model=MaintenanceResponse)
async def get_issue(
    hotel_id: int,
    issue_id: int,
    db: AsyncSession = Depends(get_db),
    actor=Depends(require_permission(Permission.VIEW_MAINTENANCE)),
):
    require_hotel_access(hotel_id, actor)
    result = await db.execute(
        select(MaintenanceIssue).where(
            MaintenanceIssue.id == issue_id, MaintenanceIssue.hotel_id == hotel_id
        )
    )
    issue = result.scalar_one_or_none()
    if not issue:
        raise HTTPException(404, "Maintenance issue not found")
    return issue


@router.patch("/{issue_id}", response_model=MaintenanceResponse)
async def update_issue(
    hotel_id: int,
    issue_id: int,
    body: MaintenanceUpdate,
    db: AsyncSession = Depends(get_db),
    actor=Depends(require_permission(Permission.MANAGE_MAINTENANCE)),
):
    require_hotel_access(hotel_id, actor)
    result = await db.execute(
        select(MaintenanceIssue).where(
            MaintenanceIssue.id == issue_id, MaintenanceIssue.hotel_id == hotel_id
        )
    )
    issue = result.scalar_one_or_none()
    if not issue:
        raise HTTPException(404, "Maintenance issue not found")

    updates = body.model_dump(exclude_none=True)

    if "status" in updates and updates["status"] != issue.status:
        allowed = MAINTENANCE_STATUS_TRANSITIONS.get(issue.status, [])
        if updates["status"] not in allowed:
            raise HTTPException(
                400,
                f"Invalid status transition: {issue.status} → {updates['status']}",
            )
        if updates["status"] in ("FIXED", "VERIFIED", "CLOSED"):
            issue.resolved_at = datetime.utcnow()
            if issue.room_id:
                room_result = await db.execute(
                    select(Room).where(Room.id == issue.room_id, Room.hotel_id == hotel_id)
                )
                room = room_result.scalar_one_or_none()
                if room and room.status in ("OUT_OF_ORDER", "MAINTENANCE"):
                    transition_room(room, "DIRTY")

    for k, v in updates.items():
        setattr(issue, k, v)

    await log_action(
        db, "UPDATE_MAINTENANCE",
        hotel_id=hotel_id, actor_type="STAFF", actor_id=actor.id, actor_name=actor.full_name,
        resource_type="maintenance_issue", resource_id=issue_id,
        details=updates,
    )
    await db.flush()
    await db.refresh(issue)
    return issue

"""
Housekeeping service: task status transitions and room-status sync.
"""

from datetime import datetime
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException

from ..models.housekeeping import HousekeepingTask, HOUSEKEEPING_STATUS_TRANSITIONS
from ..models.room import Room, transition_room
from ..schemas import HousekeepingTaskUpdate, InspectionRequest
from .audit_service import log_action


async def update_task_status(
    db: AsyncSession,
    hotel_id: int,
    task_id: int,
    new_status: str,
    actor=None,
    notes: Optional[str] = None,
    rejection_reason: Optional[str] = None,
) -> HousekeepingTask:
    result = await db.execute(
        select(HousekeepingTask).where(
            HousekeepingTask.id == task_id,
            HousekeepingTask.hotel_id == hotel_id,
        )
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(404, "Housekeeping task not found")

    allowed = HOUSEKEEPING_STATUS_TRANSITIONS.get(task.status, [])
    if new_status not in allowed:
        raise HTTPException(
            400,
            f"Invalid status transition: {task.status} → {new_status}. Allowed: {allowed}",
        )

    old_status = task.status
    task.status = new_status
    if notes:
        task.notes = (task.notes or "") + f"\n{notes}"

    now = datetime.utcnow()

    if new_status == "IN_PROGRESS" and not task.started_at:
        task.started_at = now

    if new_status == "CLEANED":
        task.completed_at = now

    if new_status == "REJECTED":
        task.rejection_reason = rejection_reason

    if new_status == "INSPECTION_PENDING":
        pass  # Waiting for supervisor

    # Sync room status
    room_result = await db.execute(select(Room).where(Room.id == task.room_id))
    room = room_result.scalar_one_or_none()

    if room:
        if new_status == "IN_PROGRESS":
            transition_room(room, "CLEANING")
        elif new_status == "CLEANED":
            transition_room(room, "CLEAN")
        elif new_status == "REJECTED":
            transition_room(room, "DIRTY")

    actor_name = actor.full_name if actor else "System"
    actor_id = actor.id if actor else None
    actor_type = "STAFF" if actor else "SYSTEM"

    await log_action(
        db,
        "HOUSEKEEPING_STATUS_CHANGED",
        hotel_id=hotel_id,
        actor_type=actor_type,
        actor_id=actor_id,
        actor_name=actor_name,
        resource_type="housekeeping_task",
        resource_id=task_id,
        details={"old": old_status, "new": new_status, "room_id": task.room_id},
    )
    await db.flush()
    await db.refresh(task)
    return task


async def inspect_task(
    db: AsyncSession,
    hotel_id: int,
    task_id: int,
    request: InspectionRequest,
    inspector=None,
) -> HousekeepingTask:
    result = await db.execute(
        select(HousekeepingTask).where(
            HousekeepingTask.id == task_id,
            HousekeepingTask.hotel_id == hotel_id,
        )
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(404, "Housekeeping task not found")

    if task.status != "INSPECTION_PENDING":
        raise HTTPException(400, f"Task must be in INSPECTION_PENDING status, got: {task.status}")

    inspector_id = inspector.id if inspector else None
    inspector_name = inspector.full_name if inspector else "System"

    task.inspected_by_id = inspector_id
    task.inspected_at = datetime.utcnow()

    room_result = await db.execute(select(Room).where(Room.id == task.room_id))
    room = room_result.scalar_one_or_none()

    if request.approved:
        task.status = "APPROVED"
        if room:
            transition_room(room, "READY")
        action = "HOUSEKEEPING_APPROVED"
    else:
        task.status = "REJECTED"
        task.rejection_reason = request.rejection_reason
        if room:
            transition_room(room, "DIRTY")
        action = "HOUSEKEEPING_REJECTED"

    await log_action(
        db,
        action,
        hotel_id=hotel_id,
        actor_type="STAFF" if inspector else "SYSTEM",
        actor_id=inspector_id,
        actor_name=inspector_name,
        resource_type="housekeeping_task",
        resource_id=task_id,
        details={
            "approved": request.approved,
            "room_id": task.room_id,
            "rejection_reason": request.rejection_reason,
        },
    )
    await db.flush()
    await db.refresh(task)
    return task

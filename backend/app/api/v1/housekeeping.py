"""
Housekeeping task CRUD + status transitions + inspection.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ...db.session import get_db
from ...models.housekeeping import HousekeepingTask
from ...schemas import (
    HousekeepingTaskCreate, HousekeepingTaskUpdate,
    HousekeepingTaskResponse, InspectionRequest,
)
from ...core.dependencies import get_current_actor, get_current_staff, require_hotel_access, require_scope, require_permission
from ...core.permissions import IntegrationScope, Permission
from ...services.housekeeping_service import update_task_status, inspect_task
from ...services.audit_service import log_action

router = APIRouter(prefix="/hotels/{hotel_id}/housekeeping", tags=["Housekeeping"])


@router.get("", response_model=List[HousekeepingTaskResponse])
async def list_tasks(
    hotel_id: int,
    status: Optional[str] = Query(None),
    room_id: Optional[int] = Query(None),
    assigned_staff_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    actor=Depends(require_scope(IntegrationScope.READ_HOUSEKEEPING)),
):
    require_hotel_access(hotel_id, actor)
    q = select(HousekeepingTask).where(HousekeepingTask.hotel_id == hotel_id)
    if status:
        q = q.where(HousekeepingTask.status == status)
    if room_id:
        q = q.where(HousekeepingTask.room_id == room_id)
    if assigned_staff_id:
        q = q.where(HousekeepingTask.assigned_staff_id == assigned_staff_id)
    result = await db.execute(q.order_by(HousekeepingTask.created_at.desc()))
    return result.scalars().all()


@router.post("", response_model=HousekeepingTaskResponse, status_code=201)
async def create_task(
    hotel_id: int,
    body: HousekeepingTaskCreate,
    db: AsyncSession = Depends(get_db),
    actor=Depends(require_scope(IntegrationScope.CREATE_HOUSEKEEPING_REQUEST)),
):
    require_hotel_access(hotel_id, actor)
    task = HousekeepingTask(
        hotel_id=hotel_id,
        room_id=body.room_id,
        reservation_id=body.reservation_id,
        task_type=body.task_type,
        priority=body.priority,
        assigned_staff_id=body.assigned_staff_id,
        notes=body.notes,
        status="ASSIGNED" if body.assigned_staff_id else "PENDING",
    )
    db.add(task)
    await db.flush()
    await log_action(
        db, "CREATE_HOUSEKEEPING_TASK",
        hotel_id=hotel_id,
        actor_type="STAFF" if hasattr(actor, "full_name") else "INTEGRATION",
        actor_id=actor.id,
        actor_name=getattr(actor, "full_name", getattr(actor, "name", "Unknown")),
        resource_type="housekeeping_task", resource_id=task.id,
        details={"room_id": body.room_id, "task_type": body.task_type},
    )
    return task


@router.get("/{task_id}", response_model=HousekeepingTaskResponse)
async def get_task(
    hotel_id: int,
    task_id: int,
    db: AsyncSession = Depends(get_db),
    actor=Depends(require_scope(IntegrationScope.READ_HOUSEKEEPING)),
):
    require_hotel_access(hotel_id, actor)
    result = await db.execute(
        select(HousekeepingTask).where(
            HousekeepingTask.id == task_id,
            HousekeepingTask.hotel_id == hotel_id,
        )
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(404, "Task not found")
    return task


@router.patch("/{task_id}", response_model=HousekeepingTaskResponse)
async def update_task(
    hotel_id: int,
    task_id: int,
    body: HousekeepingTaskUpdate,
    db: AsyncSession = Depends(get_db),
    actor=Depends(require_scope(IntegrationScope.UPDATE_HOUSEKEEPING)),
):
    require_hotel_access(hotel_id, actor)
    result = await db.execute(
        select(HousekeepingTask).where(
            HousekeepingTask.id == task_id, HousekeepingTask.hotel_id == hotel_id
        )
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(404, "Task not found")

    # Assignment: if staff assigned while PENDING, auto-transition to ASSIGNED
    if body.assigned_staff_id and not body.status:
        task.assigned_staff_id = body.assigned_staff_id
        if task.status == "PENDING":
            actor_obj = actor if hasattr(actor, "full_name") else None
            task = await update_task_status(
                db, hotel_id, task_id, "ASSIGNED",
                actor=actor_obj,
                notes=body.notes,
            )
            task.assigned_staff_id = body.assigned_staff_id
        return task

    # Status transitions via service
    if body.status and body.status != task.status:
        actor_obj = actor if hasattr(actor, "full_name") else None
        updated = await update_task_status(
            db, hotel_id, task_id, body.status,
            actor=actor_obj,
            notes=body.notes,
            rejection_reason=body.rejection_reason,
        )
        # Also update assigned_staff_id if provided
        if body.assigned_staff_id:
            updated.assigned_staff_id = body.assigned_staff_id
        return updated

    # Non-status field updates (priority, notes, etc.)
    updates = body.model_dump(exclude_none=True, exclude={"status"})
    for k, v in updates.items():
        setattr(task, k, v)
    return task


@router.post("/{task_id}/inspect", response_model=HousekeepingTaskResponse)
async def inspect(
    hotel_id: int,
    task_id: int,
    body: InspectionRequest,
    db: AsyncSession = Depends(get_db),
    actor=Depends(require_permission(Permission.INSPECT_ROOMS)),
):
    require_hotel_access(hotel_id, actor)
    return await inspect_task(db, hotel_id, task_id, body, inspector=actor)

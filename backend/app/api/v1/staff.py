"""
Staff management endpoints – create, update, disable staff.
PMS Admin has full access. Hotel Manager can manage hotel-scoped staff.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ...db.session import get_db
from ...models.staff import Staff
from ...schemas import StaffCreate, StaffUpdate, StaffResponse
from ...core.dependencies import get_current_staff, get_current_admin, require_hotel_access, require_permission
from ...core.permissions import StaffRole, Permission, get_default_permissions
from ...core.security import get_password_hash
from ...services.audit_service import log_action

router = APIRouter(prefix="/hotels/{hotel_id}/staff", tags=["Staff"])


@router.get("", response_model=List[StaffResponse])
async def list_staff(
    hotel_id: int,
    role: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    actor=Depends(require_permission(Permission.VIEW_STAFF)),
):
    require_hotel_access(hotel_id, actor)
    q = select(Staff).where(Staff.hotel_id == hotel_id)
    if role:
        q = q.where(Staff.role == role)
    result = await db.execute(q.order_by(Staff.last_name))
    return result.scalars().all()


@router.post("", response_model=StaffResponse, status_code=201)
async def create_staff(
    hotel_id: int,
    body: StaffCreate,
    db: AsyncSession = Depends(get_db),
    actor=Depends(require_permission(Permission.MANAGE_STAFF)),
):
    require_hotel_access(hotel_id, actor)

    # C1: Only PMS_ADMIN can assign PMS_ADMIN role
    if body.role == "PMS_ADMIN" and actor.role != "PMS_ADMIN":
        raise HTTPException(403, "Only PMS_ADMIN can assign PMS_ADMIN role")

    # Check email uniqueness
    existing = await db.execute(select(Staff).where(Staff.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Email already in use")

    try:
        role = StaffRole(body.role)
    except ValueError:
        raise HTTPException(400, f"Invalid role: {body.role}")

    permissions = body.permissions if body.permissions is not None else get_default_permissions(role)

    staff = Staff(
        hotel_id=hotel_id,
        first_name=body.first_name,
        last_name=body.last_name,
        email=body.email,
        hashed_password=get_password_hash(body.password),
        role=body.role,
    )
    staff.permissions_list = permissions
    db.add(staff)
    await db.flush()

    await log_action(
        db, "CREATE_STAFF",
        hotel_id=hotel_id, actor_type="STAFF", actor_id=actor.id, actor_name=actor.full_name,
        resource_type="staff", resource_id=staff.id,
        details={"email": staff.email, "role": staff.role},
    )
    return staff


@router.get("/{staff_id}", response_model=StaffResponse)
async def get_staff_member(
    hotel_id: int,
    staff_id: int,
    db: AsyncSession = Depends(get_db),
    actor=Depends(require_permission(Permission.VIEW_STAFF)),
):
    require_hotel_access(hotel_id, actor)
    result = await db.execute(
        select(Staff).where(Staff.id == staff_id, Staff.hotel_id == hotel_id)
    )
    staff = result.scalar_one_or_none()
    if not staff:
        raise HTTPException(404, "Staff not found")
    return staff


@router.patch("/{staff_id}", response_model=StaffResponse)
async def update_staff_member(
    hotel_id: int,
    staff_id: int,
    body: StaffUpdate,
    db: AsyncSession = Depends(get_db),
    actor=Depends(require_permission(Permission.MANAGE_STAFF)),
):
    require_hotel_access(hotel_id, actor)

    # C1: Block self-role/permission editing
    if staff_id == actor.id:
        if body.role is not None or body.permissions is not None:
            raise HTTPException(400, "Cannot modify your own role or permissions")

    # C1: Only PMS_ADMIN can assign PMS_ADMIN role
    if body.role == "PMS_ADMIN" and actor.role != "PMS_ADMIN":
        raise HTTPException(403, "Only PMS_ADMIN can assign PMS_ADMIN role")

    result = await db.execute(
        select(Staff).where(Staff.id == staff_id, Staff.hotel_id == hotel_id)
    )
    staff = result.scalar_one_or_none()
    if not staff:
        raise HTTPException(404, "Staff not found")

    updates = body.model_dump(exclude_none=True)
    if "password" in updates:
        staff.hashed_password = get_password_hash(updates.pop("password"))
    if "permissions" in updates:
        staff.permissions_list = updates.pop("permissions")
    for k, v in updates.items():
        setattr(staff, k, v)

    await log_action(
        db, "UPDATE_STAFF",
        hotel_id=hotel_id, actor_type="STAFF", actor_id=actor.id, actor_name=actor.full_name,
        resource_type="staff", resource_id=staff_id,
        details={k: v for k, v in updates.items() if k != "hashed_password"},
    )
    return staff


@router.delete("/{staff_id}/disable")
async def disable_staff(
    hotel_id: int,
    staff_id: int,
    db: AsyncSession = Depends(get_db),
    actor=Depends(require_permission(Permission.MANAGE_STAFF)),
):
    require_hotel_access(hotel_id, actor)
    if actor.id == staff_id:
        raise HTTPException(400, "You cannot disable your own account")

    result = await db.execute(
        select(Staff).where(Staff.id == staff_id, Staff.hotel_id == hotel_id)
    )
    staff = result.scalar_one_or_none()
    if not staff:
        raise HTTPException(404, "Staff not found")

    staff.is_active = False
    await log_action(
        db, "DISABLE_STAFF",
        hotel_id=hotel_id, actor_type="STAFF", actor_id=actor.id, actor_name=actor.full_name,
        resource_type="staff", resource_id=staff_id,
        details={"disabled_name": staff.full_name},
    )
    return {"message": f"Staff {staff.full_name} has been disabled"}

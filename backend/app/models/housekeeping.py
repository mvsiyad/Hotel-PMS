from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, func
from ..db.base import Base


class HousekeepingTask(Base):
    __tablename__ = "housekeeping_tasks"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=False)
    reservation_id = Column(Integer, ForeignKey("reservations.id"), nullable=True)
    assigned_staff_id = Column(Integer, ForeignKey("staff.id"), nullable=True)
    inspected_by_id = Column(Integer, ForeignKey("staff.id"), nullable=True)

    # CHECKOUT, STAYOVER, DEEP_CLEAN, TURNDOWN
    task_type = Column(String(30), default="CHECKOUT", nullable=False)
    # LOW, MEDIUM, HIGH, URGENT
    priority = Column(String(20), default="MEDIUM", nullable=False)
    # PENDING, ASSIGNED, IN_PROGRESS, CLEANED, INSPECTION_PENDING, APPROVED, REJECTED
    status = Column(String(30), default="PENDING", nullable=False)

    notes = Column(String(1000))
    rejection_reason = Column(String(500))

    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    inspected_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


# Valid housekeeping task status transitions
HOUSEKEEPING_STATUS_TRANSITIONS: dict[str, list[str]] = {
    "PENDING": ["ASSIGNED", "IN_PROGRESS"],
    "ASSIGNED": ["IN_PROGRESS"],
    "IN_PROGRESS": ["CLEANED"],
    "CLEANED": ["INSPECTION_PENDING"],
    "INSPECTION_PENDING": ["APPROVED", "REJECTED"],
    "APPROVED": [],
    "REJECTED": ["IN_PROGRESS"],
}

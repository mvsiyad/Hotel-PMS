from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, func
from ..db.base import Base


class MaintenanceIssue(Base):
    __tablename__ = "maintenance_issues"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=True)
    reported_by_id = Column(Integer, ForeignKey("staff.id"), nullable=True)
    assigned_staff_id = Column(Integer, ForeignKey("staff.id"), nullable=True)

    title = Column(String(255), nullable=False)
    description = Column(String(2000))
    # LOW, MEDIUM, HIGH, URGENT
    priority = Column(String(20), default="MEDIUM", nullable=False)
    # OPEN, ASSIGNED, IN_PROGRESS, FIXED, VERIFIED, CLOSED
    status = Column(String(30), default="OPEN", nullable=False)

    resolution_notes = Column(String(1000))
    mark_room_out_of_order = Column(String(5), default="false")  # "true"/"false"

    resolved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


# Valid maintenance status transitions
MAINTENANCE_STATUS_TRANSITIONS: dict[str, list[str]] = {
    "OPEN": ["ASSIGNED", "IN_PROGRESS", "CLOSED"],
    "ASSIGNED": ["IN_PROGRESS", "CLOSED"],
    "IN_PROGRESS": ["FIXED", "CLOSED"],
    "FIXED": ["VERIFIED", "IN_PROGRESS"],
    "VERIFIED": ["CLOSED"],
    "CLOSED": [],
}

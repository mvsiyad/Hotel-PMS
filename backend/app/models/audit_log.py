import json
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, func
from ..db.base import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=True, index=True)
    # STAFF, INTEGRATION, SYSTEM
    actor_type = Column(String(20), nullable=False)
    actor_id = Column(Integer, nullable=True)
    actor_name = Column(String(255), nullable=False)
    action = Column(String(100), nullable=False)   # e.g. CHECK_IN, CREATE_RESERVATION
    resource_type = Column(String(100))             # e.g. reservation, room
    resource_id = Column(String(50))               # e.g. "42"
    details_json = Column(String(5000))            # JSON dict of additional context
    ip_address = Column(String(50))
    created_at = Column(DateTime, server_default=func.now())

    @property
    def details(self) -> dict:
        try:
            return json.loads(self.details_json or "{}")
        except (json.JSONDecodeError, TypeError):
            return {}

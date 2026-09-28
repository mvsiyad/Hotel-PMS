import json
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, func
from ..db.base import Base


class Webhook(Base):
    __tablename__ = "webhooks"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    url = Column(String(500), nullable=False)
    events_json = Column(String(2000), default="[]")  # JSON array of event names
    secret = Column(String(255))   # HMAC signing secret
    is_active = Column(Boolean, default=True)
    last_triggered_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    @property
    def events_list(self) -> list[str]:
        try:
            return json.loads(self.events_json or "[]")
        except (json.JSONDecodeError, TypeError):
            return []

    @events_list.setter
    def events_list(self, value: list[str]):
        self.events_json = json.dumps(value)


# Supported webhook event types
WEBHOOK_EVENTS = [
    "ROOM_STATUS_CHANGED",
    "RESERVATION_CREATED",
    "RESERVATION_MODIFIED",
    "RESERVATION_CANCELLED",
    "CHECK_IN",
    "CHECK_OUT",
    "HOUSEKEEPING_TASK_CREATED",
    "HOUSEKEEPING_TASK_COMPLETED",
    "ROOM_OUT_OF_ORDER",
    "MAINTENANCE_CREATED",
    "MAINTENANCE_RESOLVED",
]

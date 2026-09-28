import uuid
from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey, DateTime, func
from ..db.base import Base


def generate_confirmation_number() -> str:
    return f"PMS{str(uuid.uuid4()).upper()[:8]}"


class Reservation(Base):
    __tablename__ = "reservations"

    id = Column(Integer, primary_key=True, index=True)
    confirmation_number = Column(String(20), unique=True, nullable=False, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False, index=True)
    guest_id = Column(Integer, ForeignKey("guests.id"), nullable=False)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=True)       # assigned at check-in
    room_type_id = Column(Integer, ForeignKey("room_types.id"), nullable=False)
    check_in_date = Column(Date, nullable=False)
    check_out_date = Column(Date, nullable=False)
    adults = Column(Integer, default=1)
    children = Column(Integer, default=0)
    # PENDING, CONFIRMED, CHECKED_IN, CHECKED_OUT, CANCELLED, NO_SHOW
    status = Column(String(20), default="PENDING", nullable=False)
    rate = Column(Float, nullable=False)         # nightly rate
    total_amount = Column(Float, nullable=False)
    special_requests = Column(String(1000))
    notes = Column(String(1000))
    created_by_id = Column(Integer, ForeignKey("staff.id"), nullable=True)
    checked_in_at = Column(DateTime, nullable=True)
    checked_out_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


# Valid reservation status transitions
RESERVATION_STATUS_TRANSITIONS: dict[str, list[str]] = {
    "PENDING": ["CONFIRMED", "CANCELLED"],
    "CONFIRMED": ["CHECKED_IN", "CANCELLED", "NO_SHOW"],
    "CHECKED_IN": ["CHECKED_OUT"],
    "CHECKED_OUT": [],
    "CANCELLED": [],
    "NO_SHOW": [],
}

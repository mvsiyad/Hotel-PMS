from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, func
from ..db.base import Base


class Room(Base):
    __tablename__ = "rooms"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False, index=True)
    room_number = Column(String(20), nullable=False)
    room_type_id = Column(Integer, ForeignKey("room_types.id"), nullable=False)
    floor = Column(Integer, default=1)
    occupancy_limit = Column(Integer, default=2)
    # Main status: AVAILABLE, RESERVED, OCCUPIED, DIRTY, CLEANING, CLEAN,
    #              INSPECTED, READY, OUT_OF_ORDER, MAINTENANCE
    status = Column(String(30), default="AVAILABLE", nullable=False)
    housekeeping_status = Column(String(30), default="CLEAN")
    maintenance_status = Column(String(30), default="OK")  # OK, NEEDS_REPAIR, IN_REPAIR
    notes = Column(String(500))
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


from fastapi import HTTPException

# Valid state machine transitions
ROOM_STATUS_TRANSITIONS: dict[str, list[str]] = {
    "AVAILABLE": ["RESERVED", "MAINTENANCE", "OUT_OF_ORDER", "DIRTY", "OCCUPIED", "READY"],
    "RESERVED": ["OCCUPIED", "AVAILABLE", "READY", "DIRTY", "OUT_OF_ORDER"],
    "OCCUPIED": ["DIRTY", "OUT_OF_ORDER"],
    "DIRTY": ["CLEANING", "OUT_OF_ORDER", "MAINTENANCE"],
    "CLEANING": ["CLEAN", "DIRTY", "OUT_OF_ORDER", "MAINTENANCE"],
    "CLEAN": ["INSPECTED", "READY", "DIRTY", "OUT_OF_ORDER", "MAINTENANCE"],
    "INSPECTED": ["READY", "DIRTY", "OUT_OF_ORDER", "MAINTENANCE"],
    "READY": ["AVAILABLE", "RESERVED", "OCCUPIED", "OUT_OF_ORDER", "MAINTENANCE"],
    "MAINTENANCE": ["AVAILABLE", "OUT_OF_ORDER", "DIRTY", "READY"],
    "OUT_OF_ORDER": ["MAINTENANCE", "AVAILABLE", "DIRTY", "READY"],
}


def is_valid_transition(current: str, target: str) -> bool:
    allowed = ROOM_STATUS_TRANSITIONS.get(current, [])
    return target in allowed


def transition_room(room: Room, target_status: str) -> None:
    """Safely transition a room's status according to the room FSM."""
    if room.status == target_status:
        return
    if not is_valid_transition(room.status, target_status):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status transition: {room.status} → {target_status}",
        )
    room.status = target_status

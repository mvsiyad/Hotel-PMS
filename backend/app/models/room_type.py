from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, func
from ..db.base import Base


class RoomType(Base):
    __tablename__ = "room_types"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    description = Column(String(500))
    capacity = Column(Integer, default=2)
    base_rate = Column(Float, nullable=False)
    amenities = Column(String(1000))  # JSON string
    status = Column(String(20), default="ACTIVE")  # ACTIVE, INACTIVE
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

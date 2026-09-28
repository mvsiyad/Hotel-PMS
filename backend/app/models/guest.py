from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, func
from ..db.base import Base


class Guest(Base):
    __tablename__ = "guests"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255))
    phone = Column(String(50))
    address = Column(String(500))
    nationality = Column(String(100))
    id_type = Column(String(50))      # PASSPORT, DRIVER_LICENSE, NATIONAL_ID
    id_number = Column(String(100))
    notes = Column(String(1000))
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

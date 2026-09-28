from sqlalchemy import Column, Integer, String, Boolean, DateTime, func
from ..db.base import Base


class Hotel(Base):
    __tablename__ = "hotels"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    address = Column(String(500), nullable=False)
    phone = Column(String(50), nullable=False)
    email = Column(String(255), nullable=False)
    timezone = Column(String(100), default="UTC")
    currency = Column(String(10), default="USD")
    status = Column(String(20), default="ACTIVE")  # ACTIVE, INACTIVE
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

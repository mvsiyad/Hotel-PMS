import json
from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime, func
from ..db.base import Base


class RoomServiceMenuItem(Base):
    __tablename__ = "room_service_menu_items"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(String(500))
    category = Column(String(100), default="Food")  # Food, Beverage, Dessert, etc.
    price = Column(Float, nullable=False)
    is_available = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class RoomServiceOrder(Base):
    __tablename__ = "room_service_orders"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=False)
    reservation_id = Column(Integer, ForeignKey("reservations.id"), nullable=True)
    guest_id = Column(Integer, ForeignKey("guests.id"), nullable=True)
    assigned_staff_id = Column(Integer, ForeignKey("staff.id"), nullable=True)

    items_json = Column(String(5000), nullable=False)  # JSON: [{item_id, name, quantity, price}]
    total_amount = Column(Float, nullable=False)
    special_instructions = Column(String(1000))
    # PLACED, CONFIRMED, PREPARING, READY, DELIVERED, CANCELLED
    status = Column(String(30), default="PLACED", nullable=False)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    @property
    def items_list(self) -> list:
        try:
            return json.loads(self.items_json or "[]")
        except (json.JSONDecodeError, TypeError):
            return []

    @items_list.setter
    def items_list(self, value: list):
        self.items_json = json.dumps(value)

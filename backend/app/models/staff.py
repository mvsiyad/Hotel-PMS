import json
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, func
from ..db.base import Base


class Staff(Base):
    __tablename__ = "staff"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=True, index=True)
    # PMS_ADMIN hotel_id can be None (cross-property access)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    # PMS_ADMIN, HOTEL_MANAGER, FRONT_DESK, HOUSEKEEPING, MAINTENANCE, RESTAURANT, SUPERVISOR
    role = Column(String(50), nullable=False)
    permissions_json = Column(String(2000), default="[]")  # JSON array of permission strings
    is_active = Column(Boolean, default=True)
    last_login_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    @property
    def permissions_list(self) -> list[str]:
        try:
            return json.loads(self.permissions_json or "[]")
        except (json.JSONDecodeError, TypeError):
            return []

    @permissions_list.setter
    def permissions_list(self, value: list[str]):
        self.permissions_json = json.dumps(value)

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"

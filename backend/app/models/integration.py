import json
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean, func
from ..db.base import Base


class Integration(Base):
    __tablename__ = "integrations"

    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(String(500))
    client_id = Column(String(100), unique=True, nullable=False, index=True)
    client_secret_hash = Column(String(255), nullable=False)  # SHA-256 hash, NEVER returned raw
    scopes_json = Column(String(2000), default="[]")  # JSON array of scope strings
    # ACTIVE, DISABLED, REVOKED
    status = Column(String(20), default="ACTIVE", nullable=False)
    last_used_at = Column(DateTime, nullable=True)
    created_by_id = Column(Integer, ForeignKey("staff.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    @property
    def scopes_list(self) -> list[str]:
        try:
            return json.loads(self.scopes_json or "[]")
        except (json.JSONDecodeError, TypeError):
            return []

    @scopes_list.setter
    def scopes_list(self, value: list[str]):
        self.scopes_json = json.dumps(value)

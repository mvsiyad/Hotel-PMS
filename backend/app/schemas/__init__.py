"""
Pydantic v2 schemas for the Hotel PMS API.
"""

from __future__ import annotations
from datetime import datetime, date
from typing import Optional, List, Any
from pydantic import BaseModel, EmailStr, Field, model_validator


# ─────────────────────────────────────────────────────────────────────────────
# Shared base
# ─────────────────────────────────────────────────────────────────────────────

class TimestampMixin(BaseModel):
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────────────────────────────────────
# Hotel
# ─────────────────────────────────────────────────────────────────────────────

class HotelCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    address: str = Field(..., min_length=5, max_length=500)
    phone: str = Field(..., min_length=5, max_length=50)
    email: str = Field(..., max_length=255)
    timezone: str = "UTC"
    currency: str = "USD"


class HotelUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    timezone: Optional[str] = None
    currency: Optional[str] = None
    status: Optional[str] = None


class HotelResponse(TimestampMixin):
    id: int
    name: str
    address: str
    phone: str
    email: str
    timezone: str
    currency: str
    status: str


# ─────────────────────────────────────────────────────────────────────────────
# Room Type
# ─────────────────────────────────────────────────────────────────────────────

class RoomTypeCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = None
    capacity: int = Field(default=2, ge=1, le=20)
    base_rate: float = Field(..., gt=0)
    amenities: Optional[List[str]] = None


class RoomTypeUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    capacity: Optional[int] = None
    base_rate: Optional[float] = None
    amenities: Optional[List[str]] = None
    status: Optional[str] = None


class RoomTypeResponse(TimestampMixin):
    id: int
    hotel_id: int
    name: str
    description: Optional[str]
    capacity: int
    base_rate: float
    amenities: Optional[str]
    status: str


# ─────────────────────────────────────────────────────────────────────────────
# Room
# ─────────────────────────────────────────────────────────────────────────────

class RoomCreate(BaseModel):
    room_number: str = Field(..., min_length=1, max_length=20)
    room_type_id: int
    floor: int = Field(default=1, ge=1)
    occupancy_limit: int = Field(default=2, ge=1, le=20)
    notes: Optional[str] = None


class RoomUpdate(BaseModel):
    room_number: Optional[str] = None
    room_type_id: Optional[int] = None
    floor: Optional[int] = None
    occupancy_limit: Optional[int] = None
    notes: Optional[str] = None


class RoomStatusUpdate(BaseModel):
    status: str
    reason: Optional[str] = None


class RoomResponse(TimestampMixin):
    id: int
    hotel_id: int
    room_number: str
    room_type_id: int
    floor: int
    occupancy_limit: int
    status: str
    housekeeping_status: str
    maintenance_status: str
    notes: Optional[str]


# ─────────────────────────────────────────────────────────────────────────────
# Guest
# ─────────────────────────────────────────────────────────────────────────────

class GuestCreate(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    nationality: Optional[str] = None
    id_type: Optional[str] = None
    id_number: Optional[str] = None
    notes: Optional[str] = None


class GuestUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    nationality: Optional[str] = None
    id_type: Optional[str] = None
    id_number: Optional[str] = None
    notes: Optional[str] = None


class GuestResponse(TimestampMixin):
    id: int
    hotel_id: int
    first_name: str
    last_name: str
    email: Optional[str]
    phone: Optional[str]
    address: Optional[str]
    nationality: Optional[str]
    id_type: Optional[str]
    notes: Optional[str]


# ─────────────────────────────────────────────────────────────────────────────
# Reservation
# ─────────────────────────────────────────────────────────────────────────────

class ReservationCreate(BaseModel):
    guest_id: int
    room_type_id: int
    check_in_date: date
    check_out_date: date
    adults: int = Field(default=1, ge=1)
    children: int = Field(default=0, ge=0)
    rate: Optional[float] = Field(default=None, gt=0)  # If None, use base_rate from room type
    special_requests: Optional[str] = None
    notes: Optional[str] = None

    @model_validator(mode="after")
    def validate_dates(self) -> "ReservationCreate":
        if self.check_out_date <= self.check_in_date:
            raise ValueError("check_out_date must be after check_in_date")
        return self


class ReservationUpdate(BaseModel):
    check_in_date: Optional[date] = None
    check_out_date: Optional[date] = None
    adults: Optional[int] = None
    children: Optional[int] = None
    rate: Optional[float] = Field(default=None, gt=0)
    room_type_id: Optional[int] = None
    special_requests: Optional[str] = None
    notes: Optional[str] = None

    @model_validator(mode="after")
    def validate_dates(self) -> "ReservationUpdate":
        if self.check_in_date and self.check_out_date:
            if self.check_out_date <= self.check_in_date:
                raise ValueError("check_out_date must be after check_in_date")
        return self


class CheckInRequest(BaseModel):
    room_id: int
    notes: Optional[str] = None


class CheckOutRequest(BaseModel):
    notes: Optional[str] = None


class ReservationResponse(TimestampMixin):
    id: int
    confirmation_number: str
    hotel_id: int
    guest_id: int
    room_id: Optional[int]
    room_type_id: int
    check_in_date: date
    check_out_date: date
    adults: int
    children: int
    status: str
    rate: float
    total_amount: float
    special_requests: Optional[str]
    notes: Optional[str]
    checked_in_at: Optional[datetime]
    checked_out_at: Optional[datetime]


# ─────────────────────────────────────────────────────────────────────────────
# Staff
# ─────────────────────────────────────────────────────────────────────────────

class StaffCreate(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    email: str = Field(..., max_length=255)
    password: str = Field(..., min_length=6)
    role: str
    permissions: Optional[List[str]] = None  # If None, use role defaults
    hotel_id: Optional[int] = None


class StaffUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    permissions: Optional[List[str]] = None
    is_active: Optional[bool] = None


class StaffResponse(TimestampMixin):
    id: int
    hotel_id: Optional[int]
    first_name: str
    last_name: str
    email: str
    role: str
    permissions_json: str
    is_active: bool
    last_login_at: Optional[datetime]


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    staff_id: int
    role: str
    hotel_id: Optional[int]
    permissions: List[str]


# ─────────────────────────────────────────────────────────────────────────────
# Housekeeping
# ─────────────────────────────────────────────────────────────────────────────

class HousekeepingTaskCreate(BaseModel):
    room_id: int
    reservation_id: Optional[int] = None
    task_type: str = "CHECKOUT"  # CHECKOUT, STAYOVER, DEEP_CLEAN, TURNDOWN
    priority: str = "MEDIUM"
    assigned_staff_id: Optional[int] = None
    notes: Optional[str] = None


class HousekeepingTaskUpdate(BaseModel):
    status: Optional[str] = None
    assigned_staff_id: Optional[int] = None
    priority: Optional[str] = None
    notes: Optional[str] = None
    rejection_reason: Optional[str] = None


class InspectionRequest(BaseModel):
    approved: bool
    rejection_reason: Optional[str] = None


class HousekeepingTaskResponse(TimestampMixin):
    id: int
    hotel_id: int
    room_id: int
    reservation_id: Optional[int]
    assigned_staff_id: Optional[int]
    inspected_by_id: Optional[int]
    task_type: str
    priority: str
    status: str
    notes: Optional[str]
    rejection_reason: Optional[str]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    inspected_at: Optional[datetime]


# ─────────────────────────────────────────────────────────────────────────────
# Maintenance
# ─────────────────────────────────────────────────────────────────────────────

class MaintenanceCreate(BaseModel):
    room_id: Optional[int] = None
    title: str = Field(..., min_length=3, max_length=255)
    description: Optional[str] = None
    priority: str = "MEDIUM"
    assigned_staff_id: Optional[int] = None
    mark_room_out_of_order: bool = False


class MaintenanceUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    assigned_staff_id: Optional[int] = None
    resolution_notes: Optional[str] = None


class MaintenanceResponse(TimestampMixin):
    id: int
    hotel_id: int
    room_id: Optional[int]
    reported_by_id: Optional[int]
    assigned_staff_id: Optional[int]
    title: str
    description: Optional[str]
    priority: str
    status: str
    resolution_notes: Optional[str]
    resolved_at: Optional[datetime]


# ─────────────────────────────────────────────────────────────────────────────
# Room Service
# ─────────────────────────────────────────────────────────────────────────────

class MenuItemCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    description: Optional[str] = None
    category: str = "Food"
    price: float = Field(..., gt=0)


class MenuItemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    price: Optional[float] = None
    is_available: Optional[bool] = None


class MenuItemResponse(TimestampMixin):
    id: int
    hotel_id: int
    name: str
    description: Optional[str]
    category: str
    price: float
    is_available: bool


class OrderItem(BaseModel):
    item_id: int
    quantity: int = Field(ge=1)


class RoomServiceOrderCreate(BaseModel):
    room_id: int
    reservation_id: Optional[int] = None
    guest_id: Optional[int] = None
    items: List[OrderItem]
    special_instructions: Optional[str] = None


class RoomServiceOrderUpdate(BaseModel):
    status: Optional[str] = None
    assigned_staff_id: Optional[int] = None


class RoomServiceOrderResponse(TimestampMixin):
    id: int
    hotel_id: int
    room_id: int
    reservation_id: Optional[int]
    guest_id: Optional[int]
    assigned_staff_id: Optional[int]
    items_json: str
    total_amount: float
    special_instructions: Optional[str]
    status: str


# ─────────────────────────────────────────────────────────────────────────────
# Integration
# ─────────────────────────────────────────────────────────────────────────────

class IntegrationCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    description: Optional[str] = None
    scopes: List[str] = Field(default_factory=list)


class IntegrationUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    scopes: Optional[List[str]] = None
    status: Optional[str] = None


class IntegrationTokenRequest(BaseModel):
    client_id: str
    client_secret: str


class IntegrationTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    integration_id: int
    hotel_id: int
    scopes: List[str]


class IntegrationResponse(BaseModel):
    id: int
    hotel_id: int
    name: str
    description: Optional[str]
    client_id: str
    # client_secret_hash is NEVER included
    scopes_json: str
    status: str
    last_used_at: Optional[datetime]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    model_config = {"from_attributes": True}


class IntegrationCreateResponse(IntegrationResponse):
    """Returned ONLY at creation time — includes the plain client_secret."""
    client_secret: str  # shown once, never again


# ─────────────────────────────────────────────────────────────────────────────
# Availability
# ─────────────────────────────────────────────────────────────────────────────

class AvailabilityQuery(BaseModel):
    check_in_date: date
    check_out_date: date
    room_type_id: Optional[int] = None
    adults: int = 1
    children: int = 0


class AvailabilityResult(BaseModel):
    room_type_id: int
    room_type_name: str
    base_rate: float
    total_rooms: int
    available_rooms: int
    unavailable_rooms: int
    nights: int
    total_rate: float


# ─────────────────────────────────────────────────────────────────────────────
# Rates
# ─────────────────────────────────────────────────────────────────────────────

class RateResponse(BaseModel):
    room_type_id: int
    room_type_name: str
    base_rate: float
    currency: str


# ─────────────────────────────────────────────────────────────────────────────
# Audit Log
# ─────────────────────────────────────────────────────────────────────────────

class AuditLogResponse(BaseModel):
    id: int
    hotel_id: Optional[int]
    actor_type: str
    actor_id: Optional[int]
    actor_name: str
    action: str
    resource_type: Optional[str]
    resource_id: Optional[str]
    details_json: Optional[str]
    details: Optional[Any] = None  # Parsed from details_json
    ip_address: Optional[str]
    created_at: Optional[datetime]

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_with_details(cls, log):
        import json
        obj = cls.model_validate(log)
        try:
            obj.details = json.loads(log.details_json or "{}")
        except Exception:
            obj.details = {}
        return obj


# ─────────────────────────────────────────────────────────────────────────────
# Webhook
# ─────────────────────────────────────────────────────────────────────────────

class WebhookCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    url: str = Field(..., min_length=10, max_length=500)
    events: List[str]
    secret: Optional[str] = None


class WebhookUpdate(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    events: Optional[List[str]] = None
    is_active: Optional[bool] = None


class WebhookResponse(TimestampMixin):
    id: int
    hotel_id: int
    name: str
    url: str
    events_json: str
    is_active: bool
    last_triggered_at: Optional[datetime]


# ─────────────────────────────────────────────────────────────────────────────
# Pagination
# ─────────────────────────────────────────────────────────────────────────────

class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int
    per_page: int
    pages: int


# ─────────────────────────────────────────────────────────────────────────────
# Generic message
# ─────────────────────────────────────────────────────────────────────────────

class MessageResponse(BaseModel):
    message: str
    detail: Optional[str] = None

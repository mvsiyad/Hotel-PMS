"""
Role-Based Permission System for Hotel PMS.

Each staff role has a default set of permissions.
PMS Admin can also grant additional fine-grained permissions per staff member.
"""

from enum import Enum
from typing import Set


class StaffRole(str, Enum):
    PMS_ADMIN = "PMS_ADMIN"
    HOTEL_MANAGER = "HOTEL_MANAGER"
    FRONT_DESK = "FRONT_DESK"
    HOUSEKEEPING = "HOUSEKEEPING"
    MAINTENANCE = "MAINTENANCE"
    ROOM_SERVICE = "ROOM_SERVICE"
    RESTAURANT = "RESTAURANT"  # Alias for ROOM_SERVICE
    SUPERVISOR = "SUPERVISOR"
    AUDIT = "AUDIT"


class Permission(str, Enum):
    # Hotel management
    MANAGE_HOTELS = "manage_hotels"

    # Room & room type management
    MANAGE_ROOM_TYPES = "manage_room_types"
    MANAGE_ROOMS = "manage_rooms"
    VIEW_ROOMS = "view_rooms"

    # Rates
    MANAGE_RATES = "manage_rates"
    VIEW_RATES = "view_rates"

    # Availability
    VIEW_AVAILABILITY = "view_availability"

    # Guest management
    MANAGE_GUESTS = "manage_guests"
    VIEW_GUESTS = "view_guests"

    # Reservation management
    CREATE_RESERVATIONS = "create_reservations"
    MODIFY_RESERVATIONS = "modify_reservations"
    CANCEL_RESERVATIONS = "cancel_reservations"
    VIEW_RESERVATIONS = "view_reservations"

    # Check-in / Check-out
    CHECK_IN = "check_in"
    CHECK_OUT = "check_out"

    # Housekeeping
    VIEW_HOUSEKEEPING = "view_housekeeping"
    MANAGE_HOUSEKEEPING = "manage_housekeeping"
    INSPECT_ROOMS = "inspect_rooms"

    # Maintenance
    VIEW_MAINTENANCE = "view_maintenance"
    MANAGE_MAINTENANCE = "manage_maintenance"

    # Room service
    VIEW_ROOM_SERVICE = "view_room_service"
    MANAGE_ROOM_SERVICE = "manage_room_service"

    # Staff
    MANAGE_STAFF = "manage_staff"
    VIEW_STAFF = "view_staff"

    # Integrations (PMS Admin only)
    MANAGE_INTEGRATIONS = "manage_integrations"

    # Audit logs
    VIEW_AUDIT_LOGS = "view_audit_logs"

    # Reports
    VIEW_REPORTS = "view_reports"

    # Settings
    MANAGE_SETTINGS = "manage_settings"


# Default permissions for each role
ROLE_DEFAULT_PERMISSIONS: dict[StaffRole, Set[Permission]] = {
    StaffRole.PMS_ADMIN: set(Permission),  # All permissions

    StaffRole.HOTEL_MANAGER: {
        Permission.MANAGE_ROOM_TYPES,
        Permission.MANAGE_ROOMS,
        Permission.VIEW_ROOMS,
        Permission.MANAGE_RATES,
        Permission.VIEW_RATES,
        Permission.VIEW_AVAILABILITY,
        Permission.MANAGE_GUESTS,
        Permission.VIEW_GUESTS,
        Permission.CREATE_RESERVATIONS,
        Permission.MODIFY_RESERVATIONS,
        Permission.CANCEL_RESERVATIONS,
        Permission.VIEW_RESERVATIONS,
        Permission.CHECK_IN,
        Permission.CHECK_OUT,
        Permission.VIEW_HOUSEKEEPING,
        Permission.MANAGE_HOUSEKEEPING,
        Permission.INSPECT_ROOMS,
        Permission.VIEW_MAINTENANCE,
        Permission.MANAGE_MAINTENANCE,
        Permission.VIEW_ROOM_SERVICE,
        Permission.MANAGE_ROOM_SERVICE,
        Permission.MANAGE_STAFF,
        Permission.VIEW_STAFF,
        Permission.VIEW_AUDIT_LOGS,
        Permission.VIEW_REPORTS,
    },

    StaffRole.FRONT_DESK: {
        Permission.VIEW_ROOMS,
        Permission.VIEW_RATES,
        Permission.VIEW_AVAILABILITY,
        Permission.MANAGE_GUESTS,
        Permission.VIEW_GUESTS,
        Permission.CREATE_RESERVATIONS,
        Permission.MODIFY_RESERVATIONS,
        Permission.VIEW_RESERVATIONS,
        Permission.CHECK_IN,
        Permission.CHECK_OUT,
        Permission.VIEW_HOUSEKEEPING,
        Permission.VIEW_ROOM_SERVICE,
        Permission.MANAGE_ROOM_SERVICE,
    },

    StaffRole.HOUSEKEEPING: {
        Permission.VIEW_ROOMS,
        Permission.VIEW_HOUSEKEEPING,
        Permission.MANAGE_HOUSEKEEPING,
    },

    StaffRole.MAINTENANCE: {
        Permission.VIEW_ROOMS,
        Permission.VIEW_MAINTENANCE,
        Permission.MANAGE_MAINTENANCE,
    },

    StaffRole.RESTAURANT: {
        Permission.VIEW_ROOM_SERVICE,
        Permission.MANAGE_ROOM_SERVICE,
    },

    StaffRole.ROOM_SERVICE: {
        Permission.VIEW_ROOM_SERVICE,
        Permission.MANAGE_ROOM_SERVICE,
    },

    StaffRole.SUPERVISOR: {
        Permission.VIEW_ROOMS,
        Permission.VIEW_RESERVATIONS,
        Permission.VIEW_HOUSEKEEPING,
        Permission.MANAGE_HOUSEKEEPING,
        Permission.INSPECT_ROOMS,
        Permission.VIEW_MAINTENANCE,
        Permission.VIEW_REPORTS,
        Permission.VIEW_STAFF,
    },

    StaffRole.AUDIT: {
        Permission.VIEW_AUDIT_LOGS,
        Permission.VIEW_REPORTS,
    },
}


def get_default_permissions(role: StaffRole) -> list[str]:
    """Return the default permission strings for a given role."""
    return [p.value for p in ROLE_DEFAULT_PERMISSIONS.get(role, set())]


def has_permission(staff_permissions: list[str], required: Permission) -> bool:
    """Check if a staff member has a specific permission."""
    return required.value in staff_permissions


# Integration scopes (separate from staff permissions)
class IntegrationScope(str, Enum):
    READ_ROOMS = "READ_ROOMS"
    READ_ROOM_TYPES = "READ_ROOM_TYPES"
    READ_AVAILABILITY = "READ_AVAILABILITY"
    READ_RATES = "READ_RATES"
    READ_RESERVATIONS = "READ_RESERVATIONS"
    CREATE_RESERVATIONS = "CREATE_RESERVATIONS"
    MODIFY_RESERVATIONS = "MODIFY_RESERVATIONS"
    CANCEL_RESERVATIONS = "CANCEL_RESERVATIONS"
    READ_GUESTS = "READ_GUESTS"
    CREATE_GUESTS = "CREATE_GUESTS"
    UPDATE_GUESTS = "UPDATE_GUESTS"
    CREATE_HOUSEKEEPING_REQUEST = "CREATE_HOUSEKEEPING_REQUEST"
    READ_HOUSEKEEPING = "READ_HOUSEKEEPING"
    UPDATE_HOUSEKEEPING = "UPDATE_HOUSEKEEPING"


ALL_INTEGRATION_SCOPES = [s.value for s in IntegrationScope]

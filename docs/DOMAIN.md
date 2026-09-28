# Domain rules

The business behavior of the PMS: lifecycles, side effects, and who may do what. The source of truth is
the code. Transition tables live next to their models in `backend/app/models/`. When you change a rule, update
this file and any frontend mirror of it.

## Core guest journey

```
Book (CONFIRMED, no room) ──check-in(room_id)──► CHECKED_IN        room → OCCUPIED
                                                     │
                                                 check-out          room → DIRTY
                                                     │              + HousekeepingTask(CHECKOUT, HIGH, PENDING)
                                                     ▼
                              HK: PENDING → ASSIGNED → IN_PROGRESS → CLEANED → INSPECTION_PENDING
                                  room:               CLEANING      CLEAN
                                                                        │ inspect
                                                          approved ─────┴───── rejected
                                                  task APPROVED, room READY    task REJECTED, room DIRTY
                                                                               (→ IN_PROGRESS again)
```

`tests/test_full_workflow.py` exercises this whole path. It is the best executable spec.

## Reservation lifecycle — `models/reservation.py`

```
PENDING   → CONFIRMED, CANCELLED
CONFIRMED → CHECKED_IN, CANCELLED, NO_SHOW
CHECKED_IN → CHECKED_OUT
CHECKED_OUT, CANCELLED, NO_SHOW → (terminal)
```

- `create_reservation` (services/reservation_service.py) always creates with status **CONFIRMED**, so PENDING is never used in practice. `rate` defaults to the room type's `base_rate`, and `total_amount = rate × nights`.
- Room assignment happens **only at check-in** (`room_id` is NULL before then).
- Check-in requires status CONFIRMED, and the room must be in the same hotel with status ∈ {READY, AVAILABLE, CLEAN, INSPECTED}. The room's type is **not** compared with the booking's room type.
- Check-out requires CHECKED_IN.
- Cancel uses the transition table. If the reservation has a room that is RESERVED, the room goes back to AVAILABLE. In practice this never happens, because rooms are assigned only at check-in.
- No-show is allowed only from CONFIRMED.
- PATCH is allowed only in PENDING/CONFIRMED. It recomputes `total_amount` from the stored `rate`, even when `room_type_id` changes. Dates are not re-validated.
- Validation today: `check_out_date > check_in_date` on create only. `rate` may be negative, and `guest_id` is not checked for existence.

## Room status — `models/room.py`

```
AVAILABLE    → RESERVED, MAINTENANCE, OUT_OF_ORDER, DIRTY
RESERVED     → OCCUPIED, AVAILABLE
OCCUPIED     → DIRTY
DIRTY        → CLEANING, OUT_OF_ORDER
CLEANING     → CLEAN, DIRTY
CLEAN        → INSPECTED, DIRTY
INSPECTED    → READY, DIRTY
READY        → AVAILABLE, RESERVED, OCCUPIED
MAINTENANCE  → AVAILABLE, OUT_OF_ORDER
OUT_OF_ORDER → MAINTENANCE, AVAILABLE
```

- The table is enforced **only** by `PATCH /rooms/{id}/status` (through `is_valid_transition`).
- Services write `room.status` directly and **skip** the table:

| Trigger | Room status set | Legal per table? |
|---|---|---|
| check-in | OCCUPIED | only from RESERVED/READY; check-in also allows AVAILABLE/CLEAN/INSPECTED |
| check-out | DIRTY | yes (from OCCUPIED) |
| HK → IN_PROGRESS | CLEANING | from DIRTY only |
| HK → CLEANED | CLEAN | yes (from CLEANING) |
| HK REJECTED (either path) | DIRTY | yes from CLEAN/INSPECTED |
| inspection approved | READY | **no**: the table requires CLEAN → INSPECTED → READY |
| maintenance create with `mark_room_out_of_order` | OUT_OF_ORDER | **no** when the room is OCCUPIED, etc. |
| maintenance closed | *(nothing)* | the room stays OUT_OF_ORDER |

- New rooms start as **READY** (both the API and the seed).
- `housekeeping_status` and `maintenance_status` columns exist but nothing updates them.

## Availability — `services/availability_service.py`

For each ACTIVE room type:
```
available = total_rooms
          − rooms in {OUT_OF_ORDER, MAINTENANCE}
          − rooms whose id appears on an overlapping CONFIRMED/CHECKED_IN reservation with room_id NOT NULL
overlap   = existing.check_in < requested.check_out AND existing.check_out > requested.check_in
total_rate = base_rate × nights
```
Because only in-house reservations have a `room_id`, **future bookings never reduce availability** and
nothing stops overbooking. `find_available_room()` exists but nothing calls it. Fixing this means counting
overlapping reservations **by room_type_id** against sellable rooms, and checking that count on create and modify.
(KNOWN_ISSUES C3.)

## Housekeeping task — `models/housekeeping.py`

```
PENDING            → ASSIGNED, IN_PROGRESS
ASSIGNED           → IN_PROGRESS
IN_PROGRESS        → CLEANED
CLEANED            → INSPECTION_PENDING
INSPECTION_PENDING → APPROVED, REJECTED
REJECTED           → IN_PROGRESS
APPROVED           → (terminal)
```

- Types: CHECKOUT, STAYOVER, DEEP_CLEAN, TURNDOWN. Priorities: LOW, MEDIUM, HIGH, URGENT.
- `update_task_status` sets `started_at` on the first IN_PROGRESS and `completed_at` on CLEANED, appends `notes`, syncs the room status (table above), and writes the audit action `HOUSEKEEPING_STATUS_CHANGED`.
- The inspection endpoint requires INSPECTION_PENDING. It sets `inspected_by_id` and `inspected_at` and logs `HOUSEKEEPING_APPROVED` or `HOUSEKEEPING_REJECTED`.
- PATCH with `assigned_staff_id` and **no** `status` sets the assignee, and if the task is PENDING it also moves it to ASSIGNED.
- Frontend mirror: the `TRANSITIONS` constant in `frontend/src/pages/Housekeeping.jsx`. It leaves out INSPECTION_PENDING→APPROVED/REJECTED on purpose, because the UI routes those through the Inspect modal.

## Maintenance issue — `models/maintenance.py`

```
OPEN        → ASSIGNED, IN_PROGRESS, CLOSED
ASSIGNED    → IN_PROGRESS, CLOSED
IN_PROGRESS → FIXED, CLOSED
FIXED       → VERIFIED, IN_PROGRESS
VERIFIED    → CLOSED
CLOSED      → (terminal)
```
The issue is created as ASSIGNED if an assignee is given, otherwise OPEN. `resolved_at` is set whenever the status becomes FIXED, VERIFIED, or CLOSED.

## Room-service order — inline in `api/v1/room_service.py`

```
PLACED → CONFIRMED, CANCELLED
CONFIRMED → PREPARING, CANCELLED
PREPARING → READY → DELIVERED
DELIVERED, CANCELLED → (terminal)
```
On create, each `{item_id, quantity}` is resolved against **available** menu items of the same hotel. The price comes
from the server, never the client. `items_json` stores `{item_id, name, quantity, unit_price, line_total}`. Seeded orders
use a different key shape (`menu_item_id`, no `line_total`), so code that reads `items_json` must handle both.

## Roles & default permissions — `core/permissions.py`

Permissions are **copied onto each staff row** (`permissions_json`) when the account is created. Changing
`ROLE_DEFAULT_PERMISSIONS` later does **not** update existing staff.

| Permission | ADMIN | MANAGER | FRONT_DESK | SUPERVISOR | HOUSEKEEPING | MAINTENANCE | RESTAURANT / ROOM_SERVICE | AUDIT |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| manage_hotels, manage_integrations, manage_settings | ✓ | | | | | | | |
| manage_room_types, manage_rooms, manage_rates | ✓ | ✓ | | | | | | |
| view_rooms | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | |
| view_rates, view_availability | ✓ | ✓ | ✓ | | | | | |
| manage_guests, view_guests | ✓ | ✓ | ✓ | | | | | |
| create/modify_reservations | ✓ | ✓ | ✓ | | | | | |
| cancel_reservations | ✓ | ✓ | | | | | | |
| view_reservations | ✓ | ✓ | ✓ | ✓ | | | | |
| check_in, check_out | ✓ | ✓ | ✓ | | | | | |
| view_housekeeping | ✓ | ✓ | ✓ | ✓ | ✓ | | | |
| manage_housekeeping | ✓ | ✓ | | ✓ | ✓ | | | |
| inspect_rooms | ✓ | ✓ | | ✓ | | | | |
| view/manage_maintenance | ✓ | ✓ | | view | | ✓ | | |
| view/manage_room_service | ✓ | ✓ | ✓ | | | | ✓ | |
| manage_staff | ✓ | ✓ | | | | | | |
| view_staff | ✓ | ✓ | | ✓ | | | | |
| view_audit_logs | ✓ | ✓ | | | | | | ✓ |
| view_reports | ✓ | ✓ | | ✓ | | | | ✓ |

**Important:** this matrix describes intent. On most routes it is **not enforced** today. Only routes guarded by
`require_scope` check permissions (through the scope→permission map below). Everything on `get_current_staff`
lets any role through. Staff create/update/disable is limited to PMS_ADMIN/HOTEL_MANAGER by an inline role
check. (KNOWN_ISSUES C1, C2.)

`RESTAURANT` and `ROOM_SERVICE` are duplicates. The README lists 7 roles, but the enum has 9 (it adds ROOM_SERVICE and AUDIT).

## Integration scopes

The `IntegrationScope` enum, and how `require_scope` maps each scope to a permission when the caller is **staff**:

| Scope | Used on | Staff permission checked |
|---|---|---|
| READ_ROOMS | GET rooms | view_rooms |
| READ_ROOM_TYPES | GET room-types | view_rooms |
| READ_AVAILABILITY | GET availability | view_availability |
| READ_RATES | GET rates | view_rates |
| READ_RESERVATIONS | GET reservations (list/one/by confirmation) | view_reservations |
| CREATE_RESERVATIONS | POST reservations | create_reservations |
| MODIFY_RESERVATIONS | PATCH reservation | modify_reservations |
| CANCEL_RESERVATIONS | POST cancel | cancel_reservations |
| READ_GUESTS | GET guests | view_guests |
| CREATE_GUESTS | POST guests | manage_guests |
| UPDATE_GUESTS | *(unused)* | *(unmapped)* |
| READ_HOUSEKEEPING | GET housekeeping | view_housekeeping |
| CREATE_HOUSEKEEPING_REQUEST | POST housekeeping | manage_housekeeping |
| UPDATE_HOUSEKEEPING | PATCH housekeeping | manage_housekeeping |

Integrations **cannot** call check-in/out, no-show, inspection, rooms writes, maintenance, room service, staff,
audit, or webhooks, because those routes require staff. They **can** call room-type POST/PATCH and guest PATCH
with any scope. That is a bug (H1).

Scenario for an integrating voice agent: get a token → `GET availability` → `GET rates` → `POST guests`
→ `POST reservations` → `GET reservations/confirm/{conf}` → optionally `POST housekeeping` (guest requests).

## Audit log

`log_action(db, ACTION, hotel_id=..., actor_type/actor_id/actor_name, resource_type, resource_id, details, ip_address)`.
Actions in use include STAFF_LOGIN, CREATE/UPDATE_HOTEL, CREATE/UPDATE_ROOM_TYPE, CREATE_ROOM, ROOM_STATUS_CHANGED,
CREATE_GUEST, CREATE_RESERVATION, MODIFY_RESERVATION, CHECK_IN, CHECK_OUT, CANCEL_RESERVATION, NO_SHOW,
CREATE_HOUSEKEEPING_TASK, HOUSEKEEPING_STATUS_CHANGED, HOUSEKEEPING_APPROVED/REJECTED, CREATE/UPDATE_MAINTENANCE,
CREATE/UPDATE/DISABLE_STAFF, CREATE/UPDATE_INTEGRATION, ROTATE_INTEGRATION_SECRET, REVOKE_INTEGRATION.
Nothing is logged for room PATCH, guest PATCH, menu or order changes, or webhook changes. `create_reservation`
records the actor name as the literal `"Staff"` and ignores integration actors.

## Webhook events (declared, not dispatched)

ROOM_STATUS_CHANGED, RESERVATION_CREATED, RESERVATION_MODIFIED, RESERVATION_CANCELLED, CHECK_IN, CHECK_OUT,
HOUSEKEEPING_TASK_CREATED, HOUSEKEEPING_TASK_COMPLETED, ROOM_OUT_OF_ORDER, MAINTENANCE_CREATED, MAINTENANCE_RESOLVED.

## Seed data — `services/seed_service.py`

The seed is idempotent: each entity is looked up by a natural key before insert. For hotel `{h}` it creates:
- 5 room types: Standard 99, Deluxe 149, Suite 299, Family 199, Penthouse 599.
- 24 rooms: floors 1–4 × rooms 01–06 (`101`…`406`). The type cycles by room position, and every room starts READY.
- 8 staff (password `Staff@123!`): Maria Santos (HOTEL_MANAGER), James Chen and Aisha Johnson (FRONT_DESK), Carlos Rivera and Fatima Al-Rashid (HOUSEKEEPING), Thomas Weber (MAINTENANCE), Sophie Laurent (SUPERVISOR), Raj Patel (ROOM_SERVICE).
- 8 guests and 12 menu items.
- 14 reservations relative to **today**: 4 checked out, 3 in-house, 2 arriving today, 3 upcoming, 1 cancelled, 1 no-show. Room statuses are applied directly.
- Housekeeping tasks for DIRTY rooms, plus one INSPECTION_PENDING task and one IN_PROGRESS turndown task.
- Maintenance tickets for rooms 101 and 201. Rooms `V1` and `501` are skipped unless they already exist.
- A DELIVERED room-service order for each in-house reservation.

Because arrivals and departures are relative to `date.today()`, re-seeding on a later day adds a new set of
"today" reservations rather than moving the old ones.

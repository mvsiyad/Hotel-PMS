# Known issues & improvement backlog

A living list. **When you fix an item, change its Status and add the date.** IDs C/H/M/L match the
technical review in `Hotel_PMS_Project_Report.pdf` (2026-09-27). The review confirmed "Verified" items with live
HTTP probes against an isolated copy. The others were confirmed by reading the code. N-items are additional
observations from the 2026-09-27 codebase study. Paths are relative to `backend/app/` unless noted otherwise.

Severity: **CRITICAL** = bypasses access control or corrupts core data · **HIGH** = breaks a main feature,
weakens security, or blocks deployment · **MEDIUM** = correctness or operational gap · **LOW** = quality.

## Critical

| ID | Issue | Where | Fix sketch | Status |
|---|---|---|---|---|
| C1 | **Privilege escalation.** A HOTEL_MANAGER can PATCH any staff member, including themselves, to any role (incl. PMS_ADMIN) and any permission list. POST also accepts PMS_ADMIN. *Verified: manager self-promoted, then created a hotel.* | `api/v1/staff.py` `create_staff` (L38), `update_staff_member` (L100) | Only PMS_ADMIN may grant PMS_ADMIN. Allow-list target roles per caller. Block edits to your own role/permissions. Only allow granting permissions the caller holds. | Open |
| C2 | **Role permissions are not enforced on most writes.** `require_permission()` is never used. Any staff role can check in/out, mark no-show, create/modify rooms and status, inspect, handle maintenance and room service, list staff, and read audit logs. *Verified: HOUSEKEEPING checked a guest in, read audit logs, created a room type.* | `core/dependencies.py:178`; `api/v1/reservations.py`, `rooms.py`, `housekeeping.py` (inspect), `maintenance.py`, `room_service.py`, `staff.py`, `audit.py` | Add `Depends(require_permission(Permission.X))` per route. Add one negative test per role. | Open |
| C3 | **No overbooking protection; availability overstates free rooms.** `create_reservation` never checks availability, despite its docstring. Availability only subtracts reservations with a `room_id`, which is set at check-in. *Verified: 5 bookings for the same dates in a 1-room hotel all succeeded, and availability still showed 1.* | `services/reservation_service.py:25`; `services/availability_service.py:75,123` | Count overlapping CONFIRMED/CHECKED_IN reservations **by room_type_id** against sellable rooms. Enforce this in the same transaction on create and on date/type change. | Open |

## High

| ID | Issue | Where | Fix sketch | Status |
|---|---|---|---|---|
| H1 | Any valid token, including an integration with only READ_ROOMS, can create or reprice room types and edit guests. *Verified: base_rate set to 0.01.* | `api/v1/room_types.py` POST/PATCH; `api/v1/guests.py` PATCH | Require manage_room_types/manage_rates for staff and refuse integrations for rate changes. Use the UPDATE_GUESTS scope for guest PATCH and add it to `_scope_to_perm`. | Open |
| H2 | **PATCH reservation with a date change returns 500**: `details=updates` contains `date` objects, and `json.dumps` fails. *Verified.* | `api/v1/reservations.py:129`; `services/audit_service.py:38` | `json.dumps(details or {}, default=str)` in `log_action` (this fixes every caller). Add a test. | Open |
| H3 | **Test suite fails at collection as shipped.** `backend/tests/` has no `__init__.py`, so `from tests.conftest import …` loads a second conftest copy (with a separate empty DB) or, on this machine, an unrelated `tests` package in global site-packages. *Verified: 0/29 → 29/29 after adding the file.* | `backend/tests/` | Create an empty `backend/tests/__init__.py`. Run pytest in CI. | Open |
| H4 | Unsafe defaults: `DEBUG=True` returns full tracebacks in 500 bodies and echoes all SQL. `SECRET_KEY` has a public default. The seed endpoint always returns a traceback. | `core/config.py:9,12`; `main.py:129`; `api/v1/seed.py:38` | Default DEBUG to False. Require SECRET_KEY outside dev. Never send tracebacks to clients. | Open |
| H5 | Docker deployment is broken: no Dockerfiles, env var names don't match Settings (`JWT_SECRET`/`PMS_ADMIN_*` vs `SECRET_KEY`/`FIRST_ADMIN_*`), `VITE_API_URL` is never read, there is no nginx `/api` proxy, and the healthcheck needs `curl`. | `docker-compose.yml` | Add a backend Dockerfile and a frontend nginx Dockerfile with a proxy, rename the env vars, and use a Python-based healthcheck. | Open |
| H6 | Missing input validation: negative `rate` is accepted, `guest_id` is not checked for existence or hotel, check-in doesn't compare the room's type with the booking's, PATCH doesn't re-validate dates, and changing room type doesn't reprice. *Verified for the first three.* | `schemas/__init__.py` (`ReservationCreate`/`Update`); `services/reservation_service.py:25,83` | `Field(gt=0)`. Check that the guest and room type belong to the hotel. Check `room.room_type_id` at check-in. Add a date validator on update. | Open |

## Medium

| ID | Issue | Where | Fix sketch | Status |
|---|---|---|---|---|
| M1 | Services bypass the room FSM (inspection sets READY from CLEAN; maintenance sets OUT_OF_ORDER even on an OCCUPIED room). Closing a maintenance ticket never restores the room. | `services/reservation_service.py:124,179`; `services/housekeeping_service.py:68-132`; `api/v1/maintenance.py:68` | Route every room status change through one transition helper. Handle ticket resolution. | Open |
| M2 | Webhooks are stored but never sent (no dispatcher, no HMAC signing). The secret is stored in plain text. | `models/webhook.py`; `api/v1/webhooks.py` | Add a background dispatcher with signing and retries, or label the feature a stub in the UI and API docs. | Open |
| M3 | Machine-specific paths: the default `DATABASE_URL` and the root scripts point to `C:\Users\hafiz\...`. There are two `pms.db` copies; the app uses only `backend/pms.db`. | `core/config.py:18`; root `*.py` | Use a path relative to the backend dir, or require the setting. Delete the root `pms.db`. | Open |
| M4 | No migrations. Alembic is listed but not configured, and `create_all` never alters tables. | `db/session.py:init_db` | Set up Alembic with a baseline revision. | Open |
| M5 | No pagination (only audit logs have `limit`). Dashboard and Reports download every row and compute in the browser. | `api/v1/*.py`; `frontend/src/pages/Reports.jsx`, `Dashboard.jsx` | Add limit/offset and server-side report endpoints. | Open |
| M6 | No brute-force protection on `/auth/login` or `/integrations/token` (slowapi is listed but unused). The client-secret comparison is not constant-time. | `api/v1/auth.py`; `core/security.py:verify_client_secret` | Add rate limiting or lockout. Use `hmac.compare_digest`. | Open |
| M7 | Frontend: admins are pinned to hotel 1 with no switcher, routes have no permission guards, and the Sidebar reads `user.first_name/last_name`, which the login response doesn't include (names show blank). | `frontend/src/contexts/AuthContext.jsx:27`; `components/Sidebar.jsx`; `schemas` `TokenResponse` | Add a hotel switcher, route guards, and name fields in `TokenResponse`. | Open |
| M8 | Environment: not a git repo, no venv or lockfile, no CI. (2026-09-27: the pinned versions **were** confirmed to pass 29/29 on the global Python 3.11 once H3 is fixed.) | project root; `backend/requirements.txt` | `git init` + `.gitignore`, a venv or uv lock, and CI running pytest and `vite build`. | Open |

## Low

| ID | Issue | Where | Fix sketch | Status |
|---|---|---|---|---|
| L1 | `datetime.utcnow()` is deprecated and returns naive datetimes. | `services/*`, `api/v1/*`, `core/security.py` | `datetime.now(timezone.utc)`, applied consistently. | Open |
| L2 | Weak typing: statuses are free text with no DB constraints, `mark_room_out_of_order` is the text `"true"`/`"false"`, and JSON is stored in `String` columns. | `models/*` | Enum/CheckConstraint, Boolean, JSON types (needs M4 first). | Open |
| L3 | Dead or ignored code: the `check_in_date` filter on list reservations is ignored, `generate_confirmation_number` in the model is unused (and the logic is duplicated twice), ROOM_SERVICE and RESTAURANT roles duplicate each other, and the integrations admin router has no OpenAPI tag. | `api/v1/reservations.py:31`; `models/reservation.py`; `core/permissions.py` | Apply or remove the filter, dedupe, add the tag. | Open |
| L4 | Repo clutter and personal data: root scratch scripts and output `.txt` files, caches, a stray `pms.db`. `backend/pms.db` holds a real personal email address on a staff account. | project root; `backend/pms.db` | Move scripts to `scripts/` or delete them, add `.gitignore`, scrub the DB. | Open |

## Additional observations (N-items)

| ID | Sev | Issue | Where | Status |
|---|---|---|---|---|
| N1 | LOW | `create_reservation` logs `actor_name="Staff"` (a literal) and records integration-created bookings as SYSTEM with no actor id. Use `actor_info(actor)`. | `services/reservation_service.py` (audit call); `api/v1/reservations.py` create | Open |
| N2 | LOW | Availability ignores `adults`/`children` (accepted as query params) and room-type `capacity`. | `api/v1/availability.py`; `services/availability_service.py` | Open |
| N3 | LOW | Seeded room-service orders store items as `{menu_item_id, …}`; API-created orders use `{item_id, …, line_total}`. | `services/seed_service.py`; `api/v1/room_service.py` | Open |
| N4 | LOW | `find_available_room()` is never called. Check-in takes whatever `room_id` the client sends. | `services/availability_service.py` | Open |
| N5 | LOW | FrontDesk's "ready rooms" picker leaves out INSPECTED rooms, which the backend accepts for check-in. It also shows raw ids (`Room Type #3`, `Rm. #12`). | `frontend/src/pages/FrontDesk.jsx:33` | Open |
| N6 | LOW | `Room.housekeeping_status` and `maintenance_status` are exposed in the API but never updated. | `models/room.py` | Open |
| N7 | LOW | Unused dependencies: `zustand`, `date-fns` (frontend); `alembic`, `slowapi`, `passlib`, `python-multipart` (backend; bcrypt is used directly). | `frontend/package.json`; `backend/requirements.txt` | Open |
| N8 | INFO | Role defaults are copied into `permissions_json` when staff are created. Editing `ROLE_DEFAULT_PERMISSIONS` does not affect existing staff, so a permission fix must also update existing rows. | `core/permissions.py` | By design |

## Suggested order of work

1. **Quick wins (~1 h):** H3 (`tests/__init__.py`), H2 (`default=str`), H4 (DEBUG off, no tracebacks), `git init` + `.gitignore`.
2. **Access control (1–2 days):** C1, C2, H1, M6. Add negative tests for each role.
3. **Booking correctness (2–3 days):** C3, H6, M1, N4. After this, the voice agent can trust availability.
4. **Deployability (1–2 days):** H5, M3, M4, M8.
5. **Product depth:** M2, M5, M7, guest folio/billing (not implemented at all today).
6. **Tidy-up:** L1–L4, N-items.

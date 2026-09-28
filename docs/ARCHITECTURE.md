# Architecture

How the Hotel PMS Simulator is built. For business rules (state machines, roles), see
[DOMAIN.md](DOMAIN.md). For open defects, see [KNOWN_ISSUES.md](KNOWN_ISSUES.md).

## System overview

```
 Browser (React SPA, :5174)                 External caller (voice_agent / Hotel AI)
   │  axios  /api/v1/...                        │  POST /api/v1/integrations/token  (client_id + secret)
   │  Bearer <staff JWT>                        │  Bearer <integration JWT, scoped, 24h>
   ▼                                            ▼
 Vite dev proxy  /api → http://localhost:8001 ──► FastAPI app (:8001)
                                                   ├─ CORS (localhost:5174, :3000, 127.0.0.1:5174)
                                                   ├─ /api/v1 router → 16 sub-routers
                                                   ├─ global Exception handler → JSON 500 (+traceback if DEBUG)
                                                   └─ AsyncSession per request ─► SQLite backend/pms.db
```

There are 65 HTTP endpoints (64 under `/api/v1` plus `GET /`), 13 tables, and 14 UI pages.
There are no background workers, queues, caches, or outbound HTTP calls.

## Startup (`app/main.py`)

The `lifespan` hook runs once when the app starts:
1. `init_db()` runs `Base.metadata.create_all`. It creates missing tables and never alters existing ones.
2. `_bootstrap()`: if no staff member has `FIRST_ADMIN_EMAIL`, it creates the default hotel ("Grand Azure Hotel")
   and a `PMS_ADMIN` with `hotel_id=None` and every permission. Errors are printed and swallowed.

Tests use `httpx.ASGITransport`, which does **not** run the lifespan hook, so bootstrap never runs in tests.
The fixtures create the hotel and admin themselves.

## Request lifecycle

```
HTTP request
 └─ FastAPI resolves dependencies
     ├─ get_db()                      opens AsyncSession; COMMITS after the handler returns, ROLLBACK on exception
     └─ auth dependency (one of):
         get_current_actor            decode JWT → token_type "staff" | "integration" → reload row from DB
           ├─ get_current_staff       403 if actor is an integration
           │   ├─ get_current_admin   403 unless role == PMS_ADMIN
           │   └─ require_permission(P)  403 unless P in staff.permissions   (defined, currently UNUSED)
           └─ require_scope(S)        integration: S must be in its scopes
                                      staff: S → Permission via _scope_to_perm; unmapped scope ⇒ no check
 └─ handler
     ├─ require_hotel_access(hotel_id, actor)   called manually; PMS_ADMIN bypasses; others must match hotel_id
     ├─ query/mutate, always filtered by hotel_id
     ├─ services/* for multi-step logic (they flush, never commit)
     ├─ log_action(...) adds an AuditLog row in the same transaction
     └─ return ORM object → serialized by response_model (from_attributes)
```

Key properties:
- **One transaction per request.** A mutation and its audit row succeed or fail together.
- **Actors are re-fetched on every request.** Disabling staff or revoking an integration takes effect immediately, even though JWTs cannot be revoked.
- **Tenant isolation is manual.** Each handler must call `require_hotel_access` and filter by `hotel_id`. Nothing enforces this automatically.

## Authentication

| | Staff | Integration |
|---|---|---|
| Obtain | `POST /api/v1/auth/login` `{email, password}` | `POST /api/v1/integrations/token` `{client_id, client_secret}` |
| Credential storage | bcrypt hash in `staff.hashed_password` | SHA-256 hex in `integrations.client_secret_hash` |
| JWT claims | `sub`=staff id, `hotel_id`, `role`, `token_type="staff"`, `exp` | `sub`=integration id, `hotel_id`, `scopes`, `token_type="integration"`, `exp` |
| Lifetime | 480 min (`ACCESS_TOKEN_EXPIRE_MINUTES`) | 1440 min (`INTEGRATION_TOKEN_EXPIRE_MINUTES`) |
| Authorization input | `staff.permissions_json` (seeded from role defaults, editable per user) | `integrations.scopes_json` |
| Algorithm | HS256 with `SECRET_KEY` | same |

Integration credentials: `client_id = "pms_" + 32 hex`. The secret is `token_urlsafe(48)`, shown **once** on
create or rotate and stored only as a hash. Both are created by a PMS_ADMIN from the Integrations page.

## Data model

All tables have an integer `id` and `created_at`. Most also have `updated_at` (`onupdate=func.now()`).
Every operational table has `hotel_id` (FK hotels, indexed). There are **no ORM relationships**: foreign keys are
plain columns, and related rows are fetched with explicit `select()` queries.

```
hotels ─┬─< room_types ─< rooms
        ├─< guests
        ├─< reservations  (guest_id, room_type_id, room_id NULL until check-in, created_by_id → staff)
        ├─< staff         (hotel_id NULL for PMS_ADMIN; email globally unique)
        ├─< housekeeping_tasks (room_id, reservation_id?, assigned_staff_id?, inspected_by_id?)
        ├─< maintenance_issues (room_id?, reported_by_id?, assigned_staff_id?)
        ├─< room_service_menu_items
        ├─< room_service_orders (room_id, reservation_id?, guest_id?, items_json)
        ├─< integrations  (client_id unique, scopes_json, created_by_id)
        ├─< webhooks      (events_json, secret — plain text)
        └─< audit_logs    (hotel_id nullable; actor_type STAFF|INTEGRATION|SYSTEM; details_json)
```

Storage conventions:
- Status and enum fields are `String` columns with no DB constraint. Valid values live in comments and transition dicts.
- Lists and dicts are stored as JSON text in `String` columns, with `@property` accessors (`permissions_list`, `scopes_list`, `items_list`, `events_list`, `details`).
- `room_types.amenities` is JSON text. `maintenance_issues.mark_room_out_of_order` is the text `"true"`/`"false"`.
- Money is `Float`. `reservation.total_amount = rate × nights`, computed on create and update.
- Confirmation numbers are `"PMS" + 8 hex chars from uuid4`, generated in `reservation_service._confirmation_number`.

## API map

`{h}` = `/api/v1/hotels/{hotel_id}`. The Auth column shows the dependency actually used today. "staff" means
any logged-in staff member, **regardless of role**.

| Method & path | Auth | Notes |
|---|---|---|
| `GET /` | none | service info |
| `GET /api/v1/dev/health` | none | health check |
| `POST /api/v1/dev/seed/{hotel_id}` | admin | idempotent demo data |
| `POST /api/v1/auth/login` | none | returns token + role + hotel_id + permissions (no name fields) |
| `GET /api/v1/auth/me` | staff | |
| `GET /api/v1/hotels` | staff | non-admins see only their own hotel |
| `POST /api/v1/hotels` · `PATCH /api/v1/hotels/{id}` | admin | |
| `GET /api/v1/hotels/{id}` | staff | cross-hotel check done inline |
| `GET {h}/room-types` · `GET {h}/room-types/{id}` | scope READ_ROOM_TYPES | |
| `POST {h}/room-types` · `PATCH {h}/room-types/{id}` | **any actor** | integrations included; no permission check |
| `GET {h}/rooms` · `GET {h}/rooms/{id}` | scope READ_ROOMS | filters: status, floor, room_type_id |
| `POST {h}/rooms` | staff | new rooms start as `READY`; room_number unique per hotel |
| `PATCH {h}/rooms/{id}` | staff | no audit log |
| `PATCH {h}/rooms/{id}/status` | staff | FSM-validated through `is_valid_transition` |
| `GET {h}/guests` · `GET {h}/guests/{id}` | scope READ_GUESTS | `?search=` matches name, email, phone (ILIKE) |
| `POST {h}/guests` | scope CREATE_GUESTS | |
| `PATCH {h}/guests/{id}` | **any actor** | UPDATE_GUESTS scope exists but is not used |
| `GET {h}/reservations` | scope READ_RESERVATIONS | filters: status, guest_id (`check_in_date` is accepted but ignored) |
| `POST {h}/reservations` | scope CREATE_RESERVATIONS | created as CONFIRMED; no availability check |
| `GET {h}/reservations/{id}` · `GET {h}/reservations/confirm/{conf_no}` | scope READ_RESERVATIONS | |
| `PATCH {h}/reservations/{id}` | scope MODIFY_RESERVATIONS | only PENDING/CONFIRMED; recomputes total; returns 500 on date changes (audit JSON bug) |
| `POST {h}/reservations/{id}/check-in` | staff | body `{room_id}`; room must be READY/AVAILABLE/CLEAN/INSPECTED |
| `POST {h}/reservations/{id}/check-out` | staff | room → DIRTY + auto HK task |
| `POST {h}/reservations/{id}/cancel` | scope CANCEL_RESERVATIONS | |
| `POST {h}/reservations/{id}/no-show` | staff | only from CONFIRMED |
| `GET {h}/availability?check_in_date&check_out_date[&room_type_id]` | scope READ_AVAILABILITY | adults/children accepted but unused |
| `GET {h}/rates[?room_type_id]` | scope READ_RATES | base_rate + hotel currency |
| `GET {h}/housekeeping` · `GET {h}/housekeeping/{id}` | scope READ_HOUSEKEEPING | filters: status, room_id, assigned_staff_id |
| `POST {h}/housekeeping` | scope CREATE_HOUSEKEEPING_REQUEST | ASSIGNED if staff given, else PENDING |
| `PATCH {h}/housekeeping/{id}` | scope UPDATE_HOUSEKEEPING | status changes go through `housekeeping_service.update_task_status` |
| `POST {h}/housekeeping/{id}/inspect` | staff | `{approved, rejection_reason}` |
| `GET/POST {h}/maintenance` · `GET/PATCH {h}/maintenance/{id}` | staff | optional `mark_room_out_of_order` on create |
| `GET/POST {h}/room-service/menu` · `PATCH {h}/room-service/menu/{id}` | staff | `available_only=true` by default |
| `GET/POST {h}/room-service/orders` · `PATCH {h}/room-service/orders/{id}` | staff | prices resolved from the menu on the server; no audit log |
| `GET {h}/staff` · `GET {h}/staff/{id}` | staff | |
| `POST {h}/staff` · `PATCH {h}/staff/{id}` · `DELETE {h}/staff/{id}/disable` | staff + inline role ∈ {PMS_ADMIN, HOTEL_MANAGER} | no restriction on which role can be granted |
| `POST /api/v1/integrations/token` | none (client credentials) | |
| `GET/POST {h}/integrations` · `PATCH {h}/integrations/{id}` · `POST .../rotate` · `DELETE .../revoke` | admin | secret returned only by create and rotate |
| `GET {h}/audit-logs` | staff | filters: action, actor_type, resource_type, limit ≤ 500 (default 100) |
| `GET {h}/webhooks/events` | none | static list |
| `GET/POST {h}/webhooks` · `PATCH/DELETE {h}/webhooks/{id}` | admin | stored only; never dispatched |

## Frontend

```
main.jsx → App.jsx
  AuthProvider (contexts/AuthContext.jsx)
    state: user (login response), hotelId, loading — persisted in localStorage pms_token / pms_user / pms_hotel_id
    hotelId = user.hotel_id || 1          ← admins are pinned to hotel 1
  BrowserRouter
    /login             Login
    /* ProtectedLayout (redirects to /login if no user) → Sidebar + page:
       /  Dashboard · /front-desk FrontDesk · /reservations · /rooms · /housekeeping · /maintenance
       /room-service · /guests · /staff · /integrations · /audit-logs · /reports · /settings
  Toaster (react-hot-toast)
```

- `services/api.js`: a single axios instance with `baseURL: '/api/v1'`. A request interceptor adds the Bearer token. A response interceptor clears storage on **401** and hard-redirects to `/login`.
- There is no data-fetching library or global store (`zustand` and `date-fns` are in `package.json` but unused). Each page fetches everything it needs with `Promise.all` and derives views on the client. For example, FrontDesk works out arrivals and departures by comparing ISO dates to today, and Reports computes occupancy and revenue from full lists.
- Pages show raw foreign-key ids in places (e.g. `Room Type #3`, `Rm. #12`) where a lookup map was not built.
- `Housekeeping.jsx` has Kanban and table views and auto-refreshes every 30 s. It mirrors the backend HK transition table.
- Settings has three tabs: `property` (hotel edit), `system` (read-only info), and `developer` (Run Demo Seed).
- The styling lives in one 1,268-line `index.css`, with design tokens in `:root` and a dark theme only. It uses Inter and JetBrains Mono from Google Fonts.

## Testing setup (`backend/tests/`)

- `pytest.ini`: `testpaths = tests`, `asyncio_mode = auto`.
- `conftest.py` creates an in-memory aiosqlite engine and overrides `get_db` on the app. It **drops and recreates all tables before every test** (autouse `reset_db`).
- Helpers `_create_hotel_and_admin(db)` and `_create_hotel_staff(db, hotel_id, role, email)` insert rows and log in through the API to get tokens. Test modules import them with `from tests.conftest import ...`, which is why `tests/__init__.py` is required (see DEVELOPER.md).
- There are 29 tests across 6 files: rooms (5), reservations (5), housekeeping (4), integration API (9), staff permissions (5), and one full end-to-end workflow.

## Configuration (`app/core/config.py`)

`Settings(BaseSettings)` reads `.env` from the **current working directory**. Every value has a code default:
`DEBUG=True`, a public `SECRET_KEY`, `DATABASE_URL` = an absolute Windows path to `backend/pms.db`, CORS origins,
the first admin (`admin@hotelpms.com` / `Admin@123!`), and the first hotel's details. See `backend/.env.example`.

## Deployment

Only local dev works today. `docker-compose.yml` defines backend (:8001) and frontend (:5174→80) services, but
neither Dockerfile exists, the environment variable names don't match Settings, `VITE_API_URL` is never read, and
there is no nginx `/api` proxy. See KNOWN_ISSUES H5.

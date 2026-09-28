# DEVELOPER.md — Hotel PMS Simulator

Engineering guide for developers working in this repo. Read this first, then the
deeper docs as needed:

| Doc | Read it when |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | You need the request lifecycle, auth flow, data model, or full API map |
| [docs/DOMAIN.md](docs/DOMAIN.md) | You touch reservations, rooms, housekeeping, maintenance, orders, roles, or scopes |
| [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md) | Before fixing a bug or hardening anything — it may already be tracked |

## What this project is

A standalone hotel **Property Management System simulator**. Its job is to give the separate
Hotel AI / `voice_agent` project a realistic PMS to integrate with, over REST, using scoped
integration credentials. It is a sibling project: it shares no code or database with
`voice_agent`, and its ports (8001/5174) were picked to avoid clashing with that project (8000/5173).

- **Backend**: FastAPI 0.111 + async SQLAlchemy 2.0 + SQLite (aiosqlite), Pydantic v2, JWT (python-jose), bcrypt.
- **Frontend**: React 18 + Vite 5 + react-router 6 + axios + react-hot-toast. Plain CSS design system in `src/index.css` (dark theme, CSS variables). No TypeScript, no component library, no global store.
- **Not a git repo** (as of 2026-09-27). Nothing can be rolled back, so be careful with destructive edits.

## Layout

```
backend/
  app/
    main.py              FastAPI app, lifespan bootstrap (tables + first hotel + admin), global 500 handler
    core/config.py       pydantic-settings Settings (reads backend/.env if cwd is backend/)
    core/security.py     bcrypt passwords, JWT create/decode, integration client_id/secret (SHA-256)
    core/permissions.py  StaffRole, Permission, ROLE_DEFAULT_PERMISSIONS, IntegrationScope
    core/dependencies.py get_current_actor/staff/admin, require_permission, require_scope, require_hotel_access
    db/session.py        engine, AsyncSessionLocal, get_db (commits per request), init_db (create_all)
    models/              one file per table; FSM transition dicts live next to their model
    schemas/__init__.py  ALL Pydantic schemas in one file
    services/            business logic: reservation, housekeeping, availability, audit, seed
    api/v1/              one router per resource; aggregated in api/v1/__init__.py under /api/v1
  tests/                 pytest + httpx ASGITransport, in-memory SQLite (see "Tests" below)
  pms.db                 the live dev database (the one the app uses)
frontend/
  src/services/api.js    every backend call; axios baseURL '/api/v1' (Vite proxies /api → :8001)
  src/contexts/AuthContext.jsx  token/user/hotelId in localStorage; hasPermission()
  src/components/        Sidebar.jsx, UI.jsx (Badge, Modal, FormGroup, Currency, DateDisplay, …)
  src/pages/             one page per route (13 pages + Login)
docker-compose.yml       BROKEN: see KNOWN_ISSUES (no Dockerfiles exist)
*.py / *.txt at root     leftover manual debug scripts + captured output from 2026-09-15; not part of the app
pms.db at root           stray copy; the app does NOT use it
Hotel_PMS_Project_Report.pdf  21-page technical review (2026-09-27); source of the findings in KNOWN_ISSUES
```

## Commands

Run backend commands from `backend/`. The default `DATABASE_URL` is an absolute Windows path
(`C:/Users/hafiz/hotel-test-pms/backend/pms.db`), so the app finds its DB from any cwd on this machine only.

```bash
# Backend dev server (Swagger at http://localhost:8001/docs)
cd backend
python -m venv venv && venv\Scripts\activate     # no venv exists yet; the global Python 3.11 currently has the pinned deps
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload

# Frontend dev server (http://localhost:5174, proxies /api to :8001)
cd frontend
npm install
npm run dev

# Frontend production build (sanity check that everything compiles)
npm run build

# Backend tests
cd backend
python -m pytest -q
```

**Tests currently fail at collection as shipped.** `backend/tests/` has no `__init__.py`, so
`from tests.conftest import ...` either loads a second copy of conftest (fresh empty DB) or,
on this machine, picks up an unrelated `tests` package from global site-packages. Fix: create an
empty `backend/tests/__init__.py`. Verified 2026-09-27: with that file, **29/29 pass in ~14 s**
on the pinned versions. Nothing else is needed.

Login: `admin@hotelpms.com` / `Admin@123!` (PMS_ADMIN, `hotel_id = null`). Seeded staff:
`<first>.<last>@<hotel_id>.hotel.com` / `Staff@123!` (e.g. `maria.santos@1.hotel.com`).
Seed demo data: Settings → Developer → Run Demo Seed, or `POST /api/v1/dev/seed/{hotel_id}` as admin.
The seed is idempotent.

## How the backend fits together (the 30-second version)

1. Every hotel-scoped route lives under `/api/v1/hotels/{hotel_id}/...`.
2. The auth dependency decodes the JWT, checks `token_type` (`staff` or `integration`), and **reloads
   the actor from the DB** on every request, so disabling a staff account or revoking an integration
   takes effect immediately.
3. Each handler calls `require_hotel_access(hotel_id, actor)` **by hand as its first line**. It is not a
   dependency, so forgetting it means cross-hotel data leaks. PMS_ADMIN bypasses it.
4. `get_db` wraps the whole request in one transaction and **commits after the handler returns**.
   Handlers and services only `flush()`. Do not call `commit()` inside a route or service.
5. Every meaningful mutation calls `log_action(...)` in the same transaction, so a change and its audit
   entry are saved together or not at all.
6. State changes go through the transition dicts in `models/*.py` (see docs/DOMAIN.md), except where
   services set `room.status` directly. That bypass is a known issue.

## Conventions to follow

**Adding a backend endpoint**
- Put the router in `api/v1/<resource>.py` with `prefix="/hotels/{hotel_id}/<resource>"`, and register it in `api/v1/__init__.py`.
- Schemas go in `schemas/__init__.py`: `XCreate`, `XUpdate` (all-Optional), `XResponse(TimestampMixin)` with `from_attributes`.
- Pick the auth dependency deliberately:
  - `require_scope(IntegrationScope.X)` if integrations (the voice agent) may call it. For staff it maps the scope to a Permission through `_scope_to_perm` in `core/dependencies.py`. **If the scope is not in that map, staff are not checked at all.**
  - `require_permission(Permission.X)` for staff-only actions. It exists but **no route uses it yet**; new code should.
  - `get_current_admin` for PMS_ADMIN-only actions.
  - Avoid bare `get_current_staff` / `get_current_actor` on writes. That pattern is the main access-control bug in this codebase.
- First line of the handler: `require_hotel_access(hotel_id, actor)`.
- Always filter queries by `Model.hotel_id == hotel_id` as well as by id.
- Updates use `body.model_dump(exclude_none=True)` then `setattr` in a loop.
- Log with `log_action(db, "VERB_NOUN", hotel_id=..., **actor_info(actor), resource_type=..., resource_id=..., details={...})`. `details` goes through plain `json.dumps`, so **convert dates/datetimes to str first** (or fix `audit_service.py` to use `default=str`).
- Errors: `raise HTTPException(status, "message")`. The frontend shows `err.response.data.detail` in a toast.
- Status is a plain `String` column. Validate it against the transition dict before assigning.

**Adding a model/column**
- There are **no migrations**. `init_db()` runs `create_all`, which creates missing tables but never alters existing ones. After changing a column, delete `backend/pms.db` (you lose the data) and re-seed, or `ALTER` it by hand.
- Import the new model in `models/__init__.py`. Otherwise `create_all` won't see it.
- JSON-ish data is stored as `String` with `*_json` columns plus `@property` accessors (`permissions_list`, `scopes_list`, `items_list`, `events_list`). Follow that pattern.

**Frontend**
- Add every call to `src/services/api.js` as a named export. Pages never use axios directly.
- Page pattern: `const { hotelId } = useAuth()`, a `load()` that runs `Promise.all([...])`, then `useEffect(() => { if (hotelId) load() }, [hotelId])`. Mutate, `toast.success`, call `load()` again. Show `<LoadingOverlay />` while loading.
- Style with the classes and CSS variables in `index.css` (`.btn .btn-primary`, `.stat-card`, `.table-container`, `.badge badge-<STATUS>`, `var(--text-muted)` …). Inline styles are common and accepted.
- New route: add it in `App.jsx` and in the `NAV_ITEMS` list in `components/Sidebar.jsx` (optionally with `requirePerm`).
- Access control in the UI is cosmetic (Sidebar hides links only). The backend must enforce everything.
- The frontend mirrors backend FSMs by hand (e.g. `TRANSITIONS` in `pages/Housekeeping.jsx`). If you change a backend transition table, update the mirror too.

## Gotchas that will bite you

- **Admin is hotel-less.** PMS_ADMIN has `hotel_id = null`. The frontend quietly uses hotel `1` (`AuthContext.jsx:27`), and there is no hotel switcher.
- **Reservations are created as `CONFIRMED`**, not `PENDING`, and get **no room until check-in**. Availability only counts reservations that have a `room_id`, so future bookings never reduce availability and double-booking is possible. See KNOWN_ISSUES C3.
- **Check-out auto-creates a HIGH-priority `CHECKOUT` housekeeping task** and sets the room to `DIRTY`. Tests depend on this.
- **Inspection** is a separate endpoint (`POST .../housekeeping/{id}/inspect`). APPROVED sets the room to `READY`; REJECTED sets it to `DIRTY`.
- **`DEBUG=True` by default.** 500 responses include the full traceback, and SQLAlchemy echoes every SQL statement to the console.
- **Webhooks are stored but never sent.** No dispatcher exists.
- `ReservationUpdate` with a date change returns **500** today (a date in the audit `details` breaks `json.dumps`).
- Root `test_pms_*.py`, `final_test.py`, `reset_pms_db.py`, `check_pms_db.py` hit the live server or **modify `backend/pms.db` directly** with hardcoded ids. Don't run them casually.
- `backend/pms.db` contains a real personal email on a staff account. Don't paste DB dumps into anything shared.
- `datetime.utcnow()` is used everywhere (naive UTC). Keep that consistent unless you migrate all of it.

## Verifying your change

1. `cd backend && python -m pytest -q` (after the `__init__.py` fix). All 29 should pass. Add a test for new behavior, including a **negative** test (wrong role, wrong hotel, wrong scope, invalid transition). The fixtures are in `tests/conftest.py`: `_create_hotel_and_admin(db)` and `_create_hotel_staff(db, hotel_id, role, email)` return tokens.
2. `cd frontend && npm run build` must succeed.
3. For API behavior, run uvicorn and use `/docs`, or copy the ASGITransport pattern from the tests into a scratch script. Don't point experiments at `backend/pms.db` unless you mean to change it.

## Environment notes (this machine)

- Windows 11. Python 3.11.9 (Microsoft Store build, global site-packages holds the pinned deps). Node 24.
- `frontend/node_modules` is installed. There is no backend venv.
- `.env` is optional. `backend/.env.example` lists every setting. Note that `docker-compose.yml` uses the **wrong** variable names (`JWT_SECRET`, `PMS_ADMIN_*`) where Settings expects `SECRET_KEY` and `FIRST_ADMIN_*`.

# Hotel PMS Simulator

A fully-featured **Hotel Property Management System (PMS)** simulator — standalone from the voice_agent project. Built to demonstrate realistic hotel operations with a dark luxury UI.

## ✨ Features

| Module | Description |
|--------|-------------|
| 🛎️ **Front Desk** | Check-in / check-out with room assignment, arrivals & departures board |
| 📋 **Reservations** | Full lifecycle: PENDING → CONFIRMED → CHECKED_IN → CHECKED_OUT → CANCELLED |
| 🛏️ **Rooms** | Board/table view, FSM-enforced status transitions, add rooms |
| 🧹 **Housekeeping** | Task assignment, status flow (PENDING → CLEANING → INSPECTED), inspection workflow |
| 🔧 **Maintenance** | Ticket creation, assignment, status tracking |
| 🍽️ **Room Service** | Menu management + order lifecycle |
| 👤 **Guests** | Guest CRM with search |
| 👔 **Staff** | Role-based access control with 7 roles & granular permissions |
| 🔗 **Integrations** | API key credentials with scope enforcement for external callers |
| 📊 **Reports** | Occupancy, revenue, and operational metrics |
| 🔍 **Audit Logs** | Full action history |
| ⚙️ **Settings** | Property config + developer seed tool |

## 🚀 Quick Start (Local)

### Prerequisites
- Python 3.11+
- Node.js 18+

### 1. Backend
```bash
cd backend
python -m venv venv
.\venv\Scripts\activate        # Windows
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev      # Starts on http://localhost:5174
```

### 3. Login
| Credential | Value |
|------------|-------|
| Email | `admin@hotelpms.com` |
| Password | `Admin@123!` |

### 4. Seed Demo Data
After logging in, go to **Settings → Developer** and click **Run Demo Seed**.  
Or call the API directly:
```bash
curl -X POST http://localhost:8001/api/v1/dev/seed/1 \
  -H "Authorization: Bearer <your-token>"
```

## 🐳 Docker

```bash
docker-compose up --build
```
Frontend → http://localhost:5174  
Backend API → http://localhost:8001  
Swagger UI → http://localhost:8001/docs

## 🏗️ Architecture

```
hotel-test-pms/
├── backend/              # FastAPI + SQLAlchemy async + SQLite
│   └── app/
│       ├── api/v1/       # REST endpoints (hotels, rooms, reservations, ...)
│       ├── models/       # SQLAlchemy ORM models
│       ├── schemas/      # Pydantic v2 schemas
│       ├── services/     # Business logic (availability, FSM, audit, seed)
│       └── core/         # Auth, JWT, permissions, config
└── frontend/             # React 18 + Vite, vanilla CSS design system
    └── src/
        ├── pages/        # One component per route
        ├── components/   # Sidebar, UI primitives
        ├── contexts/     # AuthContext (JWT + hotel scope)
        └── services/     # Axios API client
```

## 🔑 Staff Roles

| Role | Key Access |
|------|-----------|
| `PMS_ADMIN` | Everything |
| `HOTEL_MANAGER` | All hotel ops, no system config |
| `FRONT_DESK` | Reservations, check-in/out |
| `SUPERVISOR` | Housekeeping inspection |
| `HOUSEKEEPING` | Task management |
| `MAINTENANCE` | Maintenance tickets |
| `RESTAURANT` | Room service only |

## 📡 API Reference

Swagger UI: http://localhost:8001/docs  

Key endpoints:
- `POST /api/v1/auth/login` — Staff login
- `GET /api/v1/hotels/{id}/availability` — Real-time room availability
- `POST /api/v1/hotels/{id}/reservations/{id}/check-in` — Check in
- `POST /api/v1/integrations/token` — Integration API key → JWT

## ⚠️ Notes

- **SQLite** for development (zero config). Swap `DATABASE_URL` to PostgreSQL for production.
- This project is a **separate sibling** to the `voice_agent` project and does not share any code or database.
- Ports: backend `8001`, frontend `5174` (no conflict with voice_agent `8000`/`5173`).

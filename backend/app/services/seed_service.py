"""
Seed / demo data service for testing tools.
Provides developer-only endpoints to bootstrap realistic PMS data.
This seed is idempotent — safe to run multiple times.
"""

import traceback
from datetime import date, timedelta
import random
import json
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..models.hotel import Hotel
from ..models.room_type import RoomType
from ..models.room import Room
from ..models.guest import Guest
from ..models.reservation import Reservation
from ..models.staff import Staff
from ..models.housekeeping import HousekeepingTask
from ..models.maintenance import MaintenanceIssue
from ..models.room_service import RoomServiceMenuItem, RoomServiceOrder
from ..core.security import get_password_hash
from ..core.permissions import get_default_permissions, StaffRole
from .audit_service import log_action


# ── Seed data definitions ─────────────────────────────────────────────────────

ROOM_TYPES_SEED = [
    {"name": "Standard Room",   "description": "Comfortable standard room with city view",         "capacity": 2, "base_rate": 99.0},
    {"name": "Deluxe Room",     "description": "Spacious deluxe room with premium amenities",      "capacity": 2, "base_rate": 149.0},
    {"name": "Suite",           "description": "Luxurious suite with living area and ocean view",  "capacity": 3, "base_rate": 299.0},
    {"name": "Family Room",     "description": "Large family room with two queen beds",            "capacity": 4, "base_rate": 199.0},
    {"name": "Penthouse Suite", "description": "Ultra-luxury penthouse with panoramic views",      "capacity": 4, "base_rate": 599.0},
]

STAFF_SEEDS = [
    {"first_name": "Maria",   "last_name": "Santos",   "role": "HOTEL_MANAGER"},
    {"first_name": "James",   "last_name": "Chen",     "role": "FRONT_DESK"},
    {"first_name": "Aisha",   "last_name": "Johnson",  "role": "FRONT_DESK"},
    {"first_name": "Carlos",  "last_name": "Rivera",   "role": "HOUSEKEEPING"},
    {"first_name": "Fatima",  "last_name": "Al-Rashid","role": "HOUSEKEEPING"},
    {"first_name": "Thomas",  "last_name": "Weber",    "role": "MAINTENANCE"},
    {"first_name": "Sophie",  "last_name": "Laurent",  "role": "SUPERVISOR"},
    {"first_name": "Raj",     "last_name": "Patel",    "role": "ROOM_SERVICE"},
]

GUEST_SEEDS = [
    {"first_name": "Liam",     "last_name": "Harrison", "email": "liam.h@guest.com",     "phone": "+1-555-0101", "nationality": "US"},
    {"first_name": "Emma",     "last_name": "Williams", "email": "emma.w@guest.com",     "phone": "+44-7700-0102", "nationality": "GB"},
    {"first_name": "Noah",     "last_name": "Martinez", "email": "noah.m@guest.com",     "phone": "+34-600-0103", "nationality": "ES"},
    {"first_name": "Olivia",   "last_name": "Anderson", "email": "olivia.a@guest.com",   "phone": "+61-4000-0104", "nationality": "AU"},
    {"first_name": "Ethan",    "last_name": "Thompson", "email": "ethan.t@guest.com",    "phone": "+1-555-0105", "nationality": "US"},
    {"first_name": "Ava",      "last_name": "Garcia",   "email": "ava.g@guest.com",      "phone": "+52-55-0106", "nationality": "MX"},
    {"first_name": "Lucas",    "last_name": "Brown",    "email": "lucas.b@guest.com",    "phone": "+1-555-0107", "nationality": "US"},
    {"first_name": "Isabella", "last_name": "Davis",    "email": "isabella.d@guest.com", "phone": "+39-06-0108", "nationality": "IT"},
]

MENU_ITEMS_SEED = [
    {"name": "Club Sandwich",       "category": "Food",     "price": 18.0, "description": "Classic club with fries"},
    {"name": "Caesar Salad",        "category": "Food",     "price": 14.0, "description": "Fresh Caesar salad"},
    {"name": "Wagyu Burger",        "category": "Food",     "price": 32.0, "description": "Premium wagyu beef burger"},
    {"name": "Fish & Chips",        "category": "Food",     "price": 20.0, "description": "Beer battered fish"},
    {"name": "Margherita Pizza",    "category": "Food",     "price": 22.0, "description": "Wood-fired margherita"},
    {"name": "Chocolate Lava Cake", "category": "Dessert",  "price": 12.0, "description": "Warm chocolate lava cake"},
    {"name": "Crème Brûlée",        "category": "Dessert",  "price": 10.0, "description": "Classic French crème brûlée"},
    {"name": "Fresh Orange Juice",  "category": "Beverage", "price": 6.0,  "description": "Freshly squeezed OJ"},
    {"name": "Sparkling Water",     "category": "Beverage", "price": 4.0,  "description": "750ml sparkling bottle"},
    {"name": "Coffee",              "category": "Beverage", "price": 5.0,  "description": "Freshly brewed coffee"},
    {"name": "Craft Beer",          "category": "Beverage", "price": 9.0,  "description": "Local craft beer"},
    {"name": "Champagne",           "category": "Beverage", "price": 45.0, "description": "House champagne by the glass"},
]


def _confirmation_number() -> str:
    import uuid
    return f"PMS{str(uuid.uuid4()).upper().replace('-', '')[:8]}"


async def _first(db: AsyncSession, q):
    """Return the FIRST result or None — never raises MultipleResultsFound."""
    result = await db.execute(q.limit(1))
    return result.scalar_one_or_none()


async def seed_demo_data(db: AsyncSession, hotel_id: int) -> dict:
    """Seed rich realistic demo data for a hotel. Fully idempotent."""
    summary = {
        "room_types": 0, "rooms": 0, "staff": 0,
        "guests": 0, "reservations": 0, "menu_items": 0,
        "housekeeping_tasks": 0, "maintenance_tickets": 0, "room_service_orders": 0,
    }

    hotel = await _first(db, select(Hotel).where(Hotel.id == hotel_id))
    if not hotel:
        return {"error": "Hotel not found"}

    # ── Room Types ─────────────────────────────────────────────────────────────
    created_types = []
    for rt_data in ROOM_TYPES_SEED:
        existing = await _first(db, select(RoomType).where(
            RoomType.hotel_id == hotel_id,
            RoomType.name == rt_data["name"],
        ))
        if existing:
            created_types.append(existing)
            continue
        rt = RoomType(hotel_id=hotel_id, **rt_data)
        db.add(rt)
        await db.flush()
        created_types.append(rt)
        summary["room_types"] += 1

    # ── Rooms (4 floors × 6 rooms = 24) ───────────────────────────────────────
    room_map = {}  # room_number → Room object
    for floor in range(1, 5):
        for num in range(1, 7):
            rnum = f"{floor}{num:02d}"
            existing = await _first(db, select(Room).where(
                Room.hotel_id == hotel_id, Room.room_number == rnum,
            ))
            if existing:
                room_map[rnum] = existing
                continue
            rt = created_types[(num - 1) % len(created_types)]
            room = Room(
                hotel_id=hotel_id,
                room_number=rnum,
                room_type_id=rt.id,
                floor=floor,
                occupancy_limit=rt.capacity,
                status="READY",
            )
            db.add(room)
            await db.flush()
            room_map[rnum] = room
            summary["rooms"] += 1

    # Map any pre-existing non-standard rooms (101 old style, V1, v2, 501 etc.)
    all_rooms_result = await db.execute(select(Room).where(Room.hotel_id == hotel_id))
    for r in all_rooms_result.scalars().all():
        if r.room_number not in room_map:
            room_map[r.room_number] = r

    # ── Staff ──────────────────────────────────────────────────────────────────
    staff_map = {}  # role → Staff
    for s in STAFF_SEEDS:
        email = f"{s['first_name'].lower()}.{s['last_name'].lower()}@{hotel_id}.hotel.com"
        existing = await _first(db, select(Staff).where(Staff.email == email))
        if existing:
            staff_map[s["role"]] = existing
            continue
        try:
            role = StaffRole(s["role"])
        except ValueError:
            role = StaffRole.HOTEL_MANAGER
        member = Staff(
            hotel_id=hotel_id,
            first_name=s["first_name"],
            last_name=s["last_name"],
            email=email,
            hashed_password=get_password_hash("Staff@123!"),
            role=s["role"],
        )
        member.permissions_list = get_default_permissions(role)
        db.add(member)
        await db.flush()
        staff_map[s["role"]] = member
        summary["staff"] += 1

    hk_staff = staff_map.get("HOUSEKEEPING")
    supervisor = staff_map.get("SUPERVISOR")

    # ── Guests ─────────────────────────────────────────────────────────────────
    created_guests = []
    for g in GUEST_SEEDS:
        existing = await _first(db, select(Guest).where(
            Guest.hotel_id == hotel_id, Guest.email == g["email"],
        ))
        if existing:
            created_guests.append(existing)
            continue
        guest = Guest(hotel_id=hotel_id, **g)
        db.add(guest)
        await db.flush()
        created_guests.append(guest)
        summary["guests"] += 1

    # ── Menu Items ─────────────────────────────────────────────────────────────
    menu_items = []
    for item_data in MENU_ITEMS_SEED:
        existing = await _first(db, select(RoomServiceMenuItem).where(
            RoomServiceMenuItem.hotel_id == hotel_id,
            RoomServiceMenuItem.name == item_data["name"],
        ))
        if existing:
            menu_items.append(existing)
            continue
        item = RoomServiceMenuItem(hotel_id=hotel_id, **item_data)
        db.add(item)
        await db.flush()
        menu_items.append(item)
        summary["menu_items"] += 1

    # ── Reservations ───────────────────────────────────────────────────────────
    today = date.today()

    # Scenarios: (guest_idx, room_number, check_in_offset, nights, res_status, room_status)
    scenarios = [
        # Historical / checked out
        (0, "101", -5, 3, "CHECKED_OUT", "DIRTY"),
        (1, "102", -8, 4, "CHECKED_OUT", "READY"),
        (2, "201", -3, 2, "CHECKED_OUT", "READY"),
        (3, "202", -10, 5, "CHECKED_OUT", "READY"),
        # Currently in-house
        (4, "103", -1, 4, "CHECKED_IN", "OCCUPIED"),
        (5, "203", -2, 3, "CHECKED_IN", "OCCUPIED"),
        (6, "301", -1, 2, "CHECKED_IN", "OCCUPIED"),
        # Today's arrivals
        (7, "104", 0, 3, "CONFIRMED", "READY"),
        (0, "204", 0, 2, "CONFIRMED", "READY"),
        # Upcoming
        (1, "105", 2, 3, "CONFIRMED", "READY"),
        (2, "304", 3, 4, "CONFIRMED", "READY"),
        (3, "401", 5, 2, "CONFIRMED", "READY"),
        # Cancelled / no-show examples
        (4, "106", -2, 2, "CANCELLED", "READY"),
        (5, "206", -1, 1, "NO_SHOW",   "READY"),
    ]

    reservation_objects = []  # [(res, room, room_status)]

    for guest_idx, room_num, offset, nights, res_status, final_room_status in scenarios:
        if not created_guests:
            break
        guest = created_guests[guest_idx % len(created_guests)]
        room = room_map.get(room_num)
        if not room:
            continue  # Room might not exist yet (old-style DB)

        check_in = today + timedelta(days=offset)
        check_out = check_in + timedelta(days=nights)

        rt_result = await db.execute(select(RoomType).where(RoomType.id == room.room_type_id))
        rt = rt_result.scalar_one_or_none()
        rate = rt.base_rate if rt else 149.0

        # Idempotency: skip if same guest has reservation for this room/date
        existing_res = await _first(db, select(Reservation).where(
            Reservation.hotel_id == hotel_id,
            Reservation.guest_id == guest.id,
            Reservation.room_type_id == room.room_type_id,
            Reservation.check_in_date == check_in,
        ))
        if existing_res:
            reservation_objects.append((existing_res, room, final_room_status))
            continue

        res = Reservation(
            confirmation_number=_confirmation_number(),
            hotel_id=hotel_id,
            guest_id=guest.id,
            room_type_id=room.room_type_id,
            room_id=room.id if res_status == "CHECKED_IN" else None,
            check_in_date=check_in,
            check_out_date=check_out,
            adults=random.randint(1, 2),
            children=0,
            status=res_status,
            rate=rate,
            total_amount=rate * nights,
        )
        db.add(res)
        await db.flush()
        reservation_objects.append((res, room, final_room_status))
        summary["reservations"] += 1

        # Apply final room status (don't reset READY rooms)
        if final_room_status not in ("READY",):
            room.status = final_room_status

    await db.flush()

    # ── Housekeeping Tasks ─────────────────────────────────────────────────────
    dirty_rooms = [r for r in room_map.values() if r.status == "DIRTY"]
    for room in dirty_rooms:
        existing_hk = await _first(db, select(HousekeepingTask).where(
            HousekeepingTask.hotel_id == hotel_id,
            HousekeepingTask.room_id == room.id,
            HousekeepingTask.status.in_(["PENDING", "ASSIGNED", "IN_PROGRESS"]),
        ))
        if existing_hk:
            continue
        hk = HousekeepingTask(
            hotel_id=hotel_id,
            room_id=room.id,
            task_type="CHECKOUT",
            priority="HIGH",
            status="PENDING",
            notes="Post-checkout deep clean required",
            assigned_staff_id=hk_staff.id if hk_staff else None,
        )
        if hk_staff:
            hk.status = "ASSIGNED"
        db.add(hk)
        summary["housekeeping_tasks"] += 1

    # Add a INSPECTION_PENDING task (room just cleaned, awaiting supervisor)
    clean_room = room_map.get("202") or room_map.get("102") or (list(room_map.values())[0] if room_map else None)
    if clean_room:
        existing_inspect = await _first(db, select(HousekeepingTask).where(
            HousekeepingTask.hotel_id == hotel_id,
            HousekeepingTask.room_id == clean_room.id,
            HousekeepingTask.status == "INSPECTION_PENDING",
        ))
        if not existing_inspect:
            hk_inspect = HousekeepingTask(
                hotel_id=hotel_id,
                room_id=clean_room.id,
                task_type="CHECKOUT",
                priority="MEDIUM",
                status="INSPECTION_PENDING",
                notes="Room cleaned — awaiting supervisor inspection",
                assigned_staff_id=hk_staff.id if hk_staff else None,
            )
            db.add(hk_inspect)
            summary["housekeeping_tasks"] += 1

    # Add an IN_PROGRESS task
    occupied_rooms = [r for r in room_map.values() if r.status == "OCCUPIED"]
    if occupied_rooms:
        room = occupied_rooms[0]
        existing_turndown = await _first(db, select(HousekeepingTask).where(
            HousekeepingTask.hotel_id == hotel_id,
            HousekeepingTask.room_id == room.id,
            HousekeepingTask.task_type == "TURNDOWN",
        ))
        if not existing_turndown:
            hk_td = HousekeepingTask(
                hotel_id=hotel_id,
                room_id=room.id,
                task_type="TURNDOWN",
                priority="MEDIUM",
                status="IN_PROGRESS",
                notes="Evening turndown service",
                assigned_staff_id=hk_staff.id if hk_staff else None,
            )
            db.add(hk_td)
            summary["housekeeping_tasks"] += 1

    # ── Maintenance Issues ─────────────────────────────────────────────────────
    maint_scenarios = [
        ("101", "OPEN",        "HIGH",   "Air conditioning not cooling properly"),
        ("201", "IN_PROGRESS", "MEDIUM", "Bathroom tap leaking — slow drip"),
        ("V1",  "CLOSED",      "LOW",    "TV remote batteries replaced"),
        ("501", "OPEN",        "HIGH",   "Elevator access card reader malfunction"),
    ]
    for room_num, m_status, m_priority, m_desc in maint_scenarios:
        room = room_map.get(room_num)
        if not room:
            continue
        existing_m = await _first(db, select(MaintenanceIssue).where(
            MaintenanceIssue.hotel_id == hotel_id,
            MaintenanceIssue.room_id == room.id,
            MaintenanceIssue.title == m_desc[:60],
        ))
        if existing_m:
            continue
        ticket = MaintenanceIssue(
            hotel_id=hotel_id,
            room_id=room.id,
            title=m_desc[:60],
            description=m_desc,
            priority=m_priority,
            status=m_status,
        )
        db.add(ticket)
        summary["maintenance_tickets"] += 1

    # ── Room Service Orders ────────────────────────────────────────────────────
    for res, room, _ in reservation_objects:
        if res.status == "CHECKED_IN" and menu_items:
            existing_order = await _first(db, select(RoomServiceOrder).where(
                RoomServiceOrder.hotel_id == hotel_id,
                RoomServiceOrder.reservation_id == res.id,
            ))
            if existing_order:
                continue
            item1 = menu_items[0]
            item2 = menu_items[min(9, len(menu_items) - 1)]
            items_json = [
                {"menu_item_id": item1.id, "name": item1.name, "quantity": 1, "unit_price": item1.price},
                {"menu_item_id": item2.id, "name": item2.name, "quantity": 2, "unit_price": item2.price},
            ]
            order = RoomServiceOrder(
                hotel_id=hotel_id,
                reservation_id=res.id,
                room_id=room.id,
                items_json=json.dumps(items_json),
                total_amount=item1.price + 2 * item2.price,
                status="DELIVERED",
                special_instructions="Please leave outside the door",
            )
            db.add(order)
            summary["room_service_orders"] += 1

    await db.flush()
    return summary

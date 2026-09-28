"""
Staff permission tests: role enforcement, unauthorized operations, disabled users.
"""

import pytest
from httpx import AsyncClient
from tests.conftest import _create_hotel_and_admin, _create_hotel_staff


@pytest.mark.asyncio
async def test_housekeeping_staff_cannot_manage_reservations(client: AsyncClient, db):
    hotel, admin, admin_token = await _create_hotel_and_admin(db)
    hid = hotel.id
    admin_h = {"Authorization": f"Bearer {admin_token}"}

    # Create room type and room
    rt = await client.post(
        f"/api/v1/hotels/{hid}/room-types",
        json={"name": "Standard", "capacity": 2, "base_rate": 100.0}, headers=admin_h,
    )
    rt_id = rt.json()["id"]

    guest = await client.post(
        f"/api/v1/hotels/{hid}/guests",
        json={"first_name": "Test", "last_name": "Guest"}, headers=admin_h,
    )
    guest_id = guest.json()["id"]

    # Create housekeeping staff
    hk_staff, hk_token = await _create_hotel_staff(db, hid, "HOUSEKEEPING", f"hk@test{hid}.com")
    hk_h = {"Authorization": f"Bearer {hk_token}"}

    # Housekeeping staff tries to create a reservation — should work at API level
    # since CREATE_RESERVATIONS scope maps to staff permission
    # but housekeeping staff doesn't have create_reservations permission
    r = await client.post(
        f"/api/v1/hotels/{hid}/reservations",
        json={
            "guest_id": guest_id,
            "room_type_id": rt_id,
            "check_in_date": "2030-09-01",
            "check_out_date": "2030-09-03",
        },
        headers=hk_h,
    )
    # Housekeeping staff missing create_reservations permission → 403
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_front_desk_cannot_manage_staff(client: AsyncClient, db):
    hotel, admin, admin_token = await _create_hotel_and_admin(db)
    hid = hotel.id

    fd_staff, fd_token = await _create_hotel_staff(db, hid, "FRONT_DESK", f"fd@test{hid}.com")
    fd_h = {"Authorization": f"Bearer {fd_token}"}

    r = await client.post(
        f"/api/v1/hotels/{hid}/staff",
        json={
            "first_name": "New",
            "last_name": "Staff",
            "email": "new@test.com",
            "password": "Test@123",
            "role": "HOUSEKEEPING",
        },
        headers=fd_h,
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_disabled_staff_cannot_login(client: AsyncClient, db):
    hotel, admin, admin_token = await _create_hotel_and_admin(db)
    hid = hotel.id
    admin_h = {"Authorization": f"Bearer {admin_token}"}

    # Create staff
    r = await client.post(
        f"/api/v1/hotels/{hid}/staff",
        json={
            "first_name": "Disabled",
            "last_name": "User",
            "email": "disabled@test.com",
            "password": "Staff@123",
            "role": "FRONT_DESK",
        },
        headers=admin_h,
    )
    assert r.status_code == 201
    staff_id = r.json()["id"]

    # Disable the staff member
    disable_r = await client.delete(
        f"/api/v1/hotels/{hid}/staff/{staff_id}/disable", headers=admin_h
    )
    assert disable_r.status_code == 200

    # Try to login — should fail
    login_r = await client.post(
        "/api/v1/auth/login",
        json={"email": "disabled@test.com", "password": "Staff@123"},
    )
    assert login_r.status_code == 403


@pytest.mark.asyncio
async def test_cross_property_access_denied(client: AsyncClient, db):
    """Staff from hotel 1 cannot access hotel 2 resources."""
    from app.models import Hotel, Staff
    from app.core.security import get_password_hash
    from app.core.permissions import get_default_permissions, StaffRole

    hotel, admin, admin_token = await _create_hotel_and_admin(db)

    # Create a second hotel
    hotel2 = Hotel(name="Hotel 2", address="2 Other St", phone="+1-000", email="h2@h.com")
    db.add(hotel2)
    await db.commit()

    fd_staff, fd_token = await _create_hotel_staff(db, hotel.id, "FRONT_DESK", f"fd2@test.com")
    fd_h = {"Authorization": f"Bearer {fd_token}"}

    # Front desk staff of hotel 1 tries to access hotel 2 rooms
    r = await client.get(f"/api/v1/hotels/{hotel2.id}/rooms", headers=fd_h)
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_pms_admin_cross_hotel_access(client: AsyncClient, db):
    """PMS Admin can access any hotel."""
    from app.models import Hotel

    hotel, admin, admin_token = await _create_hotel_and_admin(db)
    admin_h = {"Authorization": f"Bearer {admin_token}"}

    hotel2 = Hotel(name="Hotel 2", address="2 Other St", phone="+1-000", email="h2@h.com")
    db.add(hotel2)
    await db.commit()

    # Admin can access hotel 2
    r = await client.get(f"/api/v1/hotels/{hotel2.id}/rooms", headers=admin_h)
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_hotel_manager_cannot_escalate_to_pms_admin(client: AsyncClient, db):
    """HOTEL_MANAGER cannot assign PMS_ADMIN role (C1)."""
    hotel, admin, admin_token = await _create_hotel_and_admin(db)
    hid = hotel.id

    hm_staff, hm_token = await _create_hotel_staff(db, hid, "HOTEL_MANAGER", f"hm@test{hid}.com")
    hm_h = {"Authorization": f"Bearer {hm_token}"}

    r = await client.post(
        f"/api/v1/hotels/{hid}/staff",
        json={
            "first_name": "Rogue",
            "last_name": "Admin",
            "email": "rogue@test.com",
            "password": "Password@123",
            "role": "PMS_ADMIN",
        },
        headers=hm_h,
    )
    assert r.status_code == 403
    assert "PMS_ADMIN" in r.json()["detail"]


@pytest.mark.asyncio
async def test_staff_cannot_modify_own_role(client: AsyncClient, db):
    """Staff cannot edit their own role or permissions (C1)."""
    hotel, admin, admin_token = await _create_hotel_and_admin(db)
    hid = hotel.id

    hm_staff, hm_token = await _create_hotel_staff(db, hid, "HOTEL_MANAGER", f"hm_self@test{hid}.com")
    hm_h = {"Authorization": f"Bearer {hm_token}"}

    r = await client.patch(
        f"/api/v1/hotels/{hid}/staff/{hm_staff.id}",
        json={"role": "PMS_ADMIN"},
        headers=hm_h,
    )
    assert r.status_code == 400
    assert "Cannot modify your own role" in r.json()["detail"]


@pytest.mark.asyncio
async def test_housekeeping_cannot_check_in_or_inspect(client: AsyncClient, db):
    """Housekeeping staff lacks CHECK_IN and INSPECT_ROOMS permissions (C2)."""
    hotel, admin, admin_token = await _create_hotel_and_admin(db)
    hid = hotel.id

    hk_staff, hk_token = await _create_hotel_staff(db, hid, "HOUSEKEEPING", f"hk_perm@test{hid}.com")
    hk_h = {"Authorization": f"Bearer {hk_token}"}

    # Attempt check-in
    r_checkin = await client.post(
        f"/api/v1/hotels/{hid}/reservations/999/check-in",
        json={"room_id": 1},
        headers=hk_h,
    )
    assert r_checkin.status_code == 403

    # Attempt inspection
    r_inspect = await client.post(
        f"/api/v1/hotels/{hid}/housekeeping/999/inspect",
        json={"result": "APPROVED"},
        headers=hk_h,
    )
    assert r_inspect.status_code == 403


@pytest.mark.asyncio
async def test_front_desk_cannot_manage_rooms(client: AsyncClient, db):
    """Front desk cannot create rooms or room types (C2)."""
    hotel, admin, admin_token = await _create_hotel_and_admin(db)
    hid = hotel.id

    fd_staff, fd_token = await _create_hotel_staff(db, hid, "FRONT_DESK", f"fd_rooms@test{hid}.com")
    fd_h = {"Authorization": f"Bearer {fd_token}"}

    # Cannot create room type
    r_rt = await client.post(
        f"/api/v1/hotels/{hid}/room-types",
        json={"name": "Deluxe", "capacity": 2, "base_rate": 150.0},
        headers=fd_h,
    )
    assert r_rt.status_code == 403

    # Cannot create room
    r_room = await client.post(
        f"/api/v1/hotels/{hid}/rooms",
        json={"room_number": "999", "room_type_id": 1, "floor": 9},
        headers=fd_h,
    )
    assert r_room.status_code == 403


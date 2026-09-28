"""
Full hotel operational workflow test.

Tests the complete end-to-end flow:
1. Create Hotel
2. Create Room Types
3. Create Rooms
4. Create Guest
5. Create Reservation
6. Check-in
7. Check-out → Room becomes DIRTY, Housekeeping task auto-created
8. Housekeeping workflow → READY
9. Verify room available for new reservation
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient
from tests.conftest import _create_hotel_and_admin


@pytest.mark.asyncio
async def test_complete_hotel_workflow(client: AsyncClient, db):
    hotel, admin, token = await _create_hotel_and_admin(db)
    h = {"Authorization": f"Bearer {token}"}
    hid = hotel.id

    # ── 1. Create Room Types ───────────────────────────────────────────────────
    rt_resp = await client.post(
        f"/api/v1/hotels/{hid}/room-types",
        json={"name": "Standard Room", "capacity": 2, "base_rate": 99.0},
        headers=h,
    )
    assert rt_resp.status_code == 201
    rt_id = rt_resp.json()["id"]

    # ── 2. Create Rooms ────────────────────────────────────────────────────────
    room_resp = await client.post(
        f"/api/v1/hotels/{hid}/rooms",
        json={"room_number": "101", "room_type_id": rt_id, "floor": 1},
        headers=h,
    )
    assert room_resp.status_code == 201
    room_id = room_resp.json()["id"]
    assert room_resp.json()["status"] == "READY"

    # ── 3. Create Guest ────────────────────────────────────────────────────────
    guest_resp = await client.post(
        f"/api/v1/hotels/{hid}/guests",
        json={"first_name": "John", "last_name": "Doe", "email": "john@test.com"},
        headers=h,
    )
    assert guest_resp.status_code == 201
    guest_id = guest_resp.json()["id"]

    # ── 4. Check Availability ──────────────────────────────────────────────────
    avail_resp = await client.get(
        f"/api/v1/hotels/{hid}/availability",
        params={"check_in_date": "2030-01-01", "check_out_date": "2030-01-03"},
        headers=h,
    )
    assert avail_resp.status_code == 200
    avail_data = avail_resp.json()
    assert len(avail_data) == 1
    assert avail_data[0]["available_rooms"] == 1

    # ── 5. Create Reservation ─────────────────────────────────────────────────
    res_resp = await client.post(
        f"/api/v1/hotels/{hid}/reservations",
        json={
            "guest_id": guest_id,
            "room_type_id": rt_id,
            "check_in_date": "2030-01-01",
            "check_out_date": "2030-01-03",
            "adults": 1,
        },
        headers=h,
    )
    assert res_resp.status_code == 201
    res_data = res_resp.json()
    res_id = res_data["id"]
    assert res_data["status"] == "CONFIRMED"
    assert res_data["total_amount"] == 99.0 * 2  # 2 nights

    # ── 6. Check-In ───────────────────────────────────────────────────────────
    checkin_resp = await client.post(
        f"/api/v1/hotels/{hid}/reservations/{res_id}/check-in",
        json={"room_id": room_id},
        headers=h,
    )
    assert checkin_resp.status_code == 200
    assert checkin_resp.json()["status"] == "CHECKED_IN"

    # Verify room is OCCUPIED
    room_status = await client.get(
        f"/api/v1/hotels/{hid}/rooms/{room_id}", headers=h
    )
    assert room_status.json()["status"] == "OCCUPIED"

    # ── 7. Check-Out ──────────────────────────────────────────────────────────
    checkout_resp = await client.post(
        f"/api/v1/hotels/{hid}/reservations/{res_id}/check-out",
        json={},
        headers=h,
    )
    assert checkout_resp.status_code == 200
    assert checkout_resp.json()["status"] == "CHECKED_OUT"

    # Verify room is DIRTY
    room_status = await client.get(
        f"/api/v1/hotels/{hid}/rooms/{room_id}", headers=h
    )
    assert room_status.json()["status"] == "DIRTY"

    # Verify housekeeping task was auto-created
    hk_resp = await client.get(
        f"/api/v1/hotels/{hid}/housekeeping",
        params={"room_id": room_id},
        headers=h,
    )
    assert hk_resp.status_code == 200
    tasks = hk_resp.json()
    assert len(tasks) == 1
    task = tasks[0]
    assert task["status"] == "PENDING"
    assert task["task_type"] == "CHECKOUT"
    task_id = task["id"]

    # ── 8. Housekeeping Workflow ───────────────────────────────────────────────
    # IN_PROGRESS
    r = await client.patch(
        f"/api/v1/hotels/{hid}/housekeeping/{task_id}",
        json={"status": "IN_PROGRESS"},
        headers=h,
    )
    assert r.status_code == 200
    assert r.json()["status"] == "IN_PROGRESS"

    # Verify room is CLEANING
    room_status = await client.get(f"/api/v1/hotels/{hid}/rooms/{room_id}", headers=h)
    assert room_status.json()["status"] == "CLEANING"

    # CLEANED
    r = await client.patch(
        f"/api/v1/hotels/{hid}/housekeeping/{task_id}",
        json={"status": "CLEANED"},
        headers=h,
    )
    assert r.status_code == 200
    assert r.json()["status"] == "CLEANED"

    # Room should be CLEAN
    room_status = await client.get(f"/api/v1/hotels/{hid}/rooms/{room_id}", headers=h)
    assert room_status.json()["status"] == "CLEAN"

    # INSPECTION_PENDING
    r = await client.patch(
        f"/api/v1/hotels/{hid}/housekeeping/{task_id}",
        json={"status": "INSPECTION_PENDING"},
        headers=h,
    )
    assert r.status_code == 200

    # ── 9. Supervisor Inspection (Approve) ────────────────────────────────────
    inspect_resp = await client.post(
        f"/api/v1/hotels/{hid}/housekeeping/{task_id}/inspect",
        json={"approved": True},
        headers=h,
    )
    assert inspect_resp.status_code == 200
    assert inspect_resp.json()["status"] == "APPROVED"

    # Room should be READY
    room_status = await client.get(f"/api/v1/hotels/{hid}/rooms/{room_id}", headers=h)
    assert room_status.json()["status"] == "READY"

    # ── 10. Room is available again ───────────────────────────────────────────
    avail_resp2 = await client.get(
        f"/api/v1/hotels/{hid}/availability",
        params={"check_in_date": "2030-02-01", "check_out_date": "2030-02-03"},
        headers=h,
    )
    assert avail_resp2.status_code == 200
    assert avail_resp2.json()[0]["available_rooms"] == 1

"""
Housekeeping workflow tests.
"""

import pytest
from httpx import AsyncClient
from tests.conftest import _create_hotel_and_admin


async def _setup_room_and_checkout(client, db):
    """Helper: create hotel, room, guest, reservation, and complete check-in/check-out."""
    hotel, admin, token = await _create_hotel_and_admin(db)
    h = {"Authorization": f"Bearer {token}"}
    hid = hotel.id

    rt = await client.post(
        f"/api/v1/hotels/{hid}/room-types",
        json={"name": "Standard", "capacity": 2, "base_rate": 100.0}, headers=h,
    )
    rt_id = rt.json()["id"]

    room = await client.post(
        f"/api/v1/hotels/{hid}/rooms",
        json={"room_number": "601", "room_type_id": rt_id, "floor": 6}, headers=h,
    )
    room_id = room.json()["id"]

    guest = await client.post(
        f"/api/v1/hotels/{hid}/guests",
        json={"first_name": "Bob", "last_name": "Tester"}, headers=h,
    )
    guest_id = guest.json()["id"]

    res = await client.post(
        f"/api/v1/hotels/{hid}/reservations",
        json={
            "guest_id": guest_id,
            "room_type_id": rt_id,
            "check_in_date": "2030-11-01",
            "check_out_date": "2030-11-03",
        },
        headers=h,
    )
    res_id = res.json()["id"]

    await client.post(
        f"/api/v1/hotels/{hid}/reservations/{res_id}/check-in",
        json={"room_id": room_id}, headers=h,
    )
    await client.post(
        f"/api/v1/hotels/{hid}/reservations/{res_id}/check-out",
        json={}, headers=h,
    )

    return hid, room_id, h


@pytest.mark.asyncio
async def test_checkout_creates_housekeeping_task(client: AsyncClient, db):
    hid, room_id, h = await _setup_room_and_checkout(client, db)

    tasks = await client.get(
        f"/api/v1/hotels/{hid}/housekeeping", params={"room_id": room_id}, headers=h
    )
    assert tasks.status_code == 200
    data = tasks.json()
    assert len(data) == 1
    assert data[0]["task_type"] == "CHECKOUT"
    assert data[0]["status"] == "PENDING"


@pytest.mark.asyncio
async def test_housekeeping_full_workflow(client: AsyncClient, db):
    """PENDING → IN_PROGRESS → CLEANED → INSPECTION_PENDING → APPROVED → room READY"""
    hid, room_id, h = await _setup_room_and_checkout(client, db)

    tasks = await client.get(
        f"/api/v1/hotels/{hid}/housekeeping", params={"room_id": room_id}, headers=h
    )
    task_id = tasks.json()[0]["id"]

    steps = ["IN_PROGRESS", "CLEANED", "INSPECTION_PENDING"]
    for status in steps:
        r = await client.patch(
            f"/api/v1/hotels/{hid}/housekeeping/{task_id}",
            json={"status": status}, headers=h,
        )
        assert r.status_code == 200, f"Failed at step {status}: {r.json()}"
        assert r.json()["status"] == status

    # Inspect and approve
    inspect = await client.post(
        f"/api/v1/hotels/{hid}/housekeeping/{task_id}/inspect",
        json={"approved": True}, headers=h,
    )
    assert inspect.status_code == 200
    assert inspect.json()["status"] == "APPROVED"

    # Room should be AVAILABLE
    room = await client.get(f"/api/v1/hotels/{hid}/rooms/{room_id}", headers=h)
    assert room.json()["status"] == "AVAILABLE"


@pytest.mark.asyncio
async def test_housekeeping_rejection_workflow(client: AsyncClient, db):
    """INSPECTION_PENDING → REJECTED → IN_PROGRESS → CLEANED → INSPECTION_PENDING → APPROVED"""
    hid, room_id, h = await _setup_room_and_checkout(client, db)

    tasks = await client.get(
        f"/api/v1/hotels/{hid}/housekeeping", params={"room_id": room_id}, headers=h
    )
    task_id = tasks.json()[0]["id"]

    for status in ["IN_PROGRESS", "CLEANED", "INSPECTION_PENDING"]:
        r = await client.patch(
            f"/api/v1/hotels/{hid}/housekeeping/{task_id}",
            json={"status": status}, headers=h,
        )
        assert r.status_code == 200

    # Reject
    reject = await client.post(
        f"/api/v1/hotels/{hid}/housekeeping/{task_id}/inspect",
        json={"approved": False, "rejection_reason": "Bathroom not cleaned properly"},
        headers=h,
    )
    assert reject.status_code == 200
    assert reject.json()["status"] == "REJECTED"

    # Room should be DIRTY again
    room = await client.get(f"/api/v1/hotels/{hid}/rooms/{room_id}", headers=h)
    assert room.json()["status"] == "DIRTY"

    # Redo cleaning
    for status in ["IN_PROGRESS", "CLEANED", "INSPECTION_PENDING"]:
        r = await client.patch(
            f"/api/v1/hotels/{hid}/housekeeping/{task_id}",
            json={"status": status}, headers=h,
        )
        assert r.status_code == 200

    # Final approval
    final = await client.post(
        f"/api/v1/hotels/{hid}/housekeeping/{task_id}/inspect",
        json={"approved": True}, headers=h,
    )
    assert final.status_code == 200
    assert final.json()["status"] == "APPROVED"

    room = await client.get(f"/api/v1/hotels/{hid}/rooms/{room_id}", headers=h)
    assert room.json()["status"] == "AVAILABLE"


@pytest.mark.asyncio
async def test_invalid_housekeeping_transition(client: AsyncClient, db):
    """Cannot skip from PENDING directly to CLEANED."""
    hid, room_id, h = await _setup_room_and_checkout(client, db)

    tasks = await client.get(
        f"/api/v1/hotels/{hid}/housekeeping", params={"room_id": room_id}, headers=h
    )
    task_id = tasks.json()[0]["id"]

    r = await client.patch(
        f"/api/v1/hotels/{hid}/housekeeping/{task_id}",
        json={"status": "APPROVED"},  # Cannot skip to APPROVED from PENDING
        headers=h,
    )
    assert r.status_code == 400

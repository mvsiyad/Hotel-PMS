"""
Room status FSM and availability tests.
"""

import pytest
from httpx import AsyncClient
from tests.conftest import _create_hotel_and_admin


@pytest.mark.asyncio
async def test_room_creation_and_status(client: AsyncClient, db):
    hotel, admin, token = await _create_hotel_and_admin(db)
    h = {"Authorization": f"Bearer {token}"}
    hid = hotel.id

    # Create room type
    rt = await client.post(
        f"/api/v1/hotels/{hid}/room-types",
        json={"name": "Deluxe", "capacity": 2, "base_rate": 150.0},
        headers=h,
    )
    rt_id = rt.json()["id"]

    # Create room
    r = await client.post(
        f"/api/v1/hotels/{hid}/rooms",
        json={"room_number": "201", "room_type_id": rt_id, "floor": 2},
        headers=h,
    )
    assert r.status_code == 201
    room_id = r.json()["id"]
    assert r.json()["status"] == "READY"


@pytest.mark.asyncio
async def test_invalid_room_status_transition(client: AsyncClient, db):
    hotel, admin, token = await _create_hotel_and_admin(db)
    h = {"Authorization": f"Bearer {token}"}
    hid = hotel.id

    rt = await client.post(
        f"/api/v1/hotels/{hid}/room-types",
        json={"name": "Standard", "capacity": 2, "base_rate": 99.0}, headers=h,
    )
    rt_id = rt.json()["id"]
    room = await client.post(
        f"/api/v1/hotels/{hid}/rooms",
        json={"room_number": "102", "room_type_id": rt_id, "floor": 1},
        headers=h,
    )
    room_id = room.json()["id"]

    # Try invalid transition: READY → DIRTY (not allowed without going through OCCUPIED)
    # Actually READY → AVAILABLE is valid, but READY → DIRTY is not
    r = await client.patch(
        f"/api/v1/hotels/{hid}/rooms/{room_id}/status",
        json={"status": "DIRTY"},
        headers=h,
    )
    assert r.status_code == 400
    assert "Invalid status transition" in r.json()["detail"]


@pytest.mark.asyncio
async def test_valid_room_status_transitions(client: AsyncClient, db):
    hotel, admin, token = await _create_hotel_and_admin(db)
    h = {"Authorization": f"Bearer {token}"}
    hid = hotel.id

    rt = await client.post(
        f"/api/v1/hotels/{hid}/room-types",
        json={"name": "Standard", "capacity": 2, "base_rate": 99.0}, headers=h,
    )
    rt_id = rt.json()["id"]
    room = await client.post(
        f"/api/v1/hotels/{hid}/rooms",
        json={"room_number": "103", "room_type_id": rt_id, "floor": 1},
        headers=h,
    )
    room_id = room.json()["id"]

    # READY → AVAILABLE
    r = await client.patch(
        f"/api/v1/hotels/{hid}/rooms/{room_id}/status",
        json={"status": "AVAILABLE"},
        headers=h,
    )
    assert r.status_code == 200
    assert r.json()["status"] == "AVAILABLE"

    # AVAILABLE → OUT_OF_ORDER
    r = await client.patch(
        f"/api/v1/hotels/{hid}/rooms/{room_id}/status",
        json={"status": "OUT_OF_ORDER"},
        headers=h,
    )
    assert r.status_code == 200
    assert r.json()["status"] == "OUT_OF_ORDER"


@pytest.mark.asyncio
async def test_out_of_order_room_not_counted_available(client: AsyncClient, db):
    hotel, admin, token = await _create_hotel_and_admin(db)
    h = {"Authorization": f"Bearer {token}"}
    hid = hotel.id

    rt = await client.post(
        f"/api/v1/hotels/{hid}/room-types",
        json={"name": "Suite", "capacity": 3, "base_rate": 300.0}, headers=h,
    )
    rt_id = rt.json()["id"]

    # Create 2 rooms
    r1 = await client.post(
        f"/api/v1/hotels/{hid}/rooms",
        json={"room_number": "301", "room_type_id": rt_id, "floor": 3}, headers=h,
    )
    r2 = await client.post(
        f"/api/v1/hotels/{hid}/rooms",
        json={"room_number": "302", "room_type_id": rt_id, "floor": 3}, headers=h,
    )
    room1_id = r1.json()["id"]

    # Mark room1 as OUT_OF_ORDER
    await client.patch(
        f"/api/v1/hotels/{hid}/rooms/{room1_id}/status",
        json={"status": "AVAILABLE"}, headers=h,
    )
    await client.patch(
        f"/api/v1/hotels/{hid}/rooms/{room1_id}/status",
        json={"status": "OUT_OF_ORDER"}, headers=h,
    )

    # Availability should show only 1
    avail = await client.get(
        f"/api/v1/hotels/{hid}/availability",
        params={"check_in_date": "2030-03-01", "check_out_date": "2030-03-03",
                "room_type_id": rt_id},
        headers=h,
    )
    assert avail.status_code == 200
    data = avail.json()
    assert len(data) == 1
    assert data[0]["available_rooms"] == 1
    assert data[0]["unavailable_rooms"] == 1


@pytest.mark.asyncio
async def test_no_duplicate_room_number(client: AsyncClient, db):
    hotel, admin, token = await _create_hotel_and_admin(db)
    h = {"Authorization": f"Bearer {token}"}
    hid = hotel.id

    rt = await client.post(
        f"/api/v1/hotels/{hid}/room-types",
        json={"name": "Standard", "capacity": 2, "base_rate": 99.0}, headers=h,
    )
    rt_id = rt.json()["id"]

    await client.post(
        f"/api/v1/hotels/{hid}/rooms",
        json={"room_number": "401", "room_type_id": rt_id, "floor": 4}, headers=h,
    )
    # Duplicate
    r = await client.post(
        f"/api/v1/hotels/{hid}/rooms",
        json={"room_number": "401", "room_type_id": rt_id, "floor": 4}, headers=h,
    )
    assert r.status_code == 400

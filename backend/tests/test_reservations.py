"""
Reservation tests: creation, modification, cancellation, double-booking prevention.
"""

import pytest
from httpx import AsyncClient
from tests.conftest import _create_hotel_and_admin


async def _setup(client, db):
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
        json={"room_number": "501", "room_type_id": rt_id, "floor": 5}, headers=h,
    )
    room_id = room.json()["id"]

    guest = await client.post(
        f"/api/v1/hotels/{hid}/guests",
        json={"first_name": "Alice", "last_name": "Smith"}, headers=h,
    )
    guest_id = guest.json()["id"]

    return hid, rt_id, room_id, guest_id, h


@pytest.mark.asyncio
async def test_create_reservation(client: AsyncClient, db):
    hid, rt_id, room_id, guest_id, h = await _setup(client, db)

    r = await client.post(
        f"/api/v1/hotels/{hid}/reservations",
        json={
            "guest_id": guest_id,
            "room_type_id": rt_id,
            "check_in_date": "2030-05-01",
            "check_out_date": "2030-05-04",
            "adults": 2,
        },
        headers=h,
    )
    assert r.status_code == 201
    data = r.json()
    assert data["status"] == "CONFIRMED"
    assert data["total_amount"] == 300.0  # 3 nights * 100
    assert data["confirmation_number"].startswith("PMS")


@pytest.mark.asyncio
async def test_invalid_dates(client: AsyncClient, db):
    hid, rt_id, room_id, guest_id, h = await _setup(client, db)

    r = await client.post(
        f"/api/v1/hotels/{hid}/reservations",
        json={
            "guest_id": guest_id,
            "room_type_id": rt_id,
            "check_in_date": "2030-05-04",
            "check_out_date": "2030-05-01",  # before check-in!
        },
        headers=h,
    )
    assert r.status_code == 422  # Pydantic validation error


@pytest.mark.asyncio
async def test_cancel_reservation(client: AsyncClient, db):
    hid, rt_id, room_id, guest_id, h = await _setup(client, db)

    res = await client.post(
        f"/api/v1/hotels/{hid}/reservations",
        json={
            "guest_id": guest_id,
            "room_type_id": rt_id,
            "check_in_date": "2030-06-01",
            "check_out_date": "2030-06-03",
        },
        headers=h,
    )
    res_id = res.json()["id"]

    cancel = await client.post(
        f"/api/v1/hotels/{hid}/reservations/{res_id}/cancel", headers=h
    )
    assert cancel.status_code == 200
    assert cancel.json()["status"] == "CANCELLED"


@pytest.mark.asyncio
async def test_no_show(client: AsyncClient, db):
    hid, rt_id, room_id, guest_id, h = await _setup(client, db)

    res = await client.post(
        f"/api/v1/hotels/{hid}/reservations",
        json={
            "guest_id": guest_id,
            "room_type_id": rt_id,
            "check_in_date": "2030-07-01",
            "check_out_date": "2030-07-02",
        },
        headers=h,
    )
    res_id = res.json()["id"]

    ns = await client.post(
        f"/api/v1/hotels/{hid}/reservations/{res_id}/no-show", headers=h
    )
    assert ns.status_code == 200
    assert ns.json()["status"] == "NO_SHOW"


@pytest.mark.asyncio
async def test_check_in_to_unready_room(client: AsyncClient, db):
    hid, rt_id, room_id, guest_id, h = await _setup(client, db)

    # Mark room DIRTY
    await client.patch(
        f"/api/v1/hotels/{hid}/rooms/{room_id}/status",
        json={"status": "AVAILABLE"}, headers=h,
    )
    await client.patch(
        f"/api/v1/hotels/{hid}/rooms/{room_id}/status",
        json={"status": "DIRTY"}, headers=h,
    )

    res = await client.post(
        f"/api/v1/hotels/{hid}/reservations",
        json={
            "guest_id": guest_id,
            "room_type_id": rt_id,
            "check_in_date": "2030-08-01",
            "check_out_date": "2030-08-03",
        },
        headers=h,
    )
    res_id = res.json()["id"]

    r = await client.post(
        f"/api/v1/hotels/{hid}/reservations/{res_id}/check-in",
        json={"room_id": room_id},
        headers=h,
    )
    assert r.status_code == 400
    assert "not ready" in r.json()["detail"].lower()


@pytest.mark.asyncio
async def test_overbooking_prevention(client: AsyncClient, db):
    """C3: Booking beyond room capacity for overlapping dates returns 409."""
    hid, rt_id, room_id, guest_id, h = await _setup(client, db)

    # Room type has 1 room (501). Create first reservation: May 1 to May 4
    r1 = await client.post(
        f"/api/v1/hotels/{hid}/reservations",
        json={
            "guest_id": guest_id,
            "room_type_id": rt_id,
            "check_in_date": "2030-05-01",
            "check_out_date": "2030-05-04",
        },
        headers=h,
    )
    assert r1.status_code == 201

    # Second overlapping reservation: May 2 to May 5 -> MUST be rejected with 409
    r2 = await client.post(
        f"/api/v1/hotels/{hid}/reservations",
        json={
            "guest_id": guest_id,
            "room_type_id": rt_id,
            "check_in_date": "2030-05-02",
            "check_out_date": "2030-05-05",
        },
        headers=h,
    )
    assert r2.status_code == 409
    assert "No availability" in r2.json()["detail"]


@pytest.mark.asyncio
async def test_adjacent_booking_allowed(client: AsyncClient, db):
    """Booking that checks in on another's checkout date does not overlap."""
    hid, rt_id, room_id, guest_id, h = await _setup(client, db)

    r1 = await client.post(
        f"/api/v1/hotels/{hid}/reservations",
        json={
            "guest_id": guest_id,
            "room_type_id": rt_id,
            "check_in_date": "2030-05-01",
            "check_out_date": "2030-05-04",
        },
        headers=h,
    )
    assert r1.status_code == 201

    # Checks in on May 4 (checkout date of r1) -> no overlap
    r2 = await client.post(
        f"/api/v1/hotels/{hid}/reservations",
        json={
            "guest_id": guest_id,
            "room_type_id": rt_id,
            "check_in_date": "2030-05-04",
            "check_out_date": "2030-05-07",
        },
        headers=h,
    )
    assert r2.status_code == 201


@pytest.mark.asyncio
async def test_negative_rate_rejected(client: AsyncClient, db):
    """H6: Rates <= 0 are rejected by validation."""
    hid, rt_id, room_id, guest_id, h = await _setup(client, db)

    r = await client.post(
        f"/api/v1/hotels/{hid}/reservations",
        json={
            "guest_id": guest_id,
            "room_type_id": rt_id,
            "check_in_date": "2030-05-01",
            "check_out_date": "2030-05-04",
            "rate": -100.0,
        },
        headers=h,
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_check_in_room_type_mismatch(client: AsyncClient, db):
    """Check-in is rejected if assigned room doesn't match reservation room type."""
    hid, rt_id, room_id, guest_id, h = await _setup(client, db)

    # Create a second room type and room
    rt2 = await client.post(
        f"/api/v1/hotels/{hid}/room-types",
        json={"name": "Suite", "capacity": 4, "base_rate": 300.0}, headers=h,
    )
    rt2_id = rt2.json()["id"]
    room2 = await client.post(
        f"/api/v1/hotels/{hid}/rooms",
        json={"room_number": "601", "room_type_id": rt2_id, "floor": 6}, headers=h,
    )
    room2_id = room2.json()["id"]

    # Reservation is for rt_id (Standard)
    res = await client.post(
        f"/api/v1/hotels/{hid}/reservations",
        json={
            "guest_id": guest_id,
            "room_type_id": rt_id,
            "check_in_date": "2030-05-10",
            "check_out_date": "2030-05-12",
        },
        headers=h,
    )
    res_id = res.json()["id"]

    # Try checking into room2 (Suite) -> rejected
    r = await client.post(
        f"/api/v1/hotels/{hid}/reservations/{res_id}/check-in",
        json={"room_id": room2_id},
        headers=h,
    )
    assert r.status_code == 400
    assert "does not match reservation room type" in r.json()["detail"]


@pytest.mark.asyncio
async def test_maintenance_resolution_restores_room_to_dirty(client: AsyncClient, db):
    """When maintenance issue is resolved, room transitions from OUT_OF_ORDER to DIRTY."""
    hid, rt_id, room_id, guest_id, h = await _setup(client, db)

    # Create maintenance ticket marking room OUT_OF_ORDER
    issue_r = await client.post(
        f"/api/v1/hotels/{hid}/maintenance",
        json={
            "room_id": room_id,
            "title": "Broken AC",
            "mark_room_out_of_order": True,
        },
        headers=h,
    )
    assert issue_r.status_code == 201
    issue_id = issue_r.json()["id"]

    # Verify room is OUT_OF_ORDER
    room_r = await client.get(f"/api/v1/hotels/{hid}/rooms/{room_id}", headers=h)
    assert room_r.json()["status"] == "OUT_OF_ORDER"

    # Resolve/close maintenance ticket
    update_r = await client.patch(
        f"/api/v1/hotels/{hid}/maintenance/{issue_id}",
        json={"status": "CLOSED"},
        headers=h,
    )
    assert update_r.status_code == 200

    # Room must now be DIRTY (ready for housekeeping to clean)
    room_r2 = await client.get(f"/api/v1/hotels/{hid}/rooms/{room_id}", headers=h)
    assert room_r2.json()["status"] == "DIRTY"


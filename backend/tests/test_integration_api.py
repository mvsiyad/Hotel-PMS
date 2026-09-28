"""
Integration API credential and scope tests.

Tests:
- Valid credentials → token
- Invalid credentials → 401
- Revoked integration → 403
- Scope enforcement (allowed vs denied)
- Cross-property access prevention
"""

import pytest
from httpx import AsyncClient
from tests.conftest import _create_hotel_and_admin


async def _create_integration(client, hotel_id, headers, name="Hotel AI Platform", scopes=None):
    """Helper to create an integration and return client_id, client_secret, integration_id."""
    scopes = scopes or ["READ_ROOMS", "READ_AVAILABILITY", "READ_RESERVATIONS", "CREATE_RESERVATIONS"]
    r = await client.post(
        f"/api/v1/hotels/{hotel_id}/integrations",
        json={"name": name, "scopes": scopes},
        headers=headers,
    )
    assert r.status_code == 201
    data = r.json()
    return data["client_id"], data["client_secret"], data["id"]


async def _get_integration_token(client, client_id, client_secret):
    r = await client.post(
        "/api/v1/integrations/token",
        json={"client_id": client_id, "client_secret": client_secret},
    )
    return r


@pytest.mark.asyncio
async def test_integration_token_valid_credentials(client: AsyncClient, db):
    hotel, admin, admin_token = await _create_hotel_and_admin(db)
    admin_h = {"Authorization": f"Bearer {admin_token}"}

    client_id, client_secret, int_id = await _create_integration(client, hotel.id, admin_h)

    r = await _get_integration_token(client, client_id, client_secret)
    assert r.status_code == 200
    data = r.json()
    assert "access_token" in data
    assert data["hotel_id"] == hotel.id
    assert "READ_ROOMS" in data["scopes"]


@pytest.mark.asyncio
async def test_integration_token_invalid_secret(client: AsyncClient, db):
    hotel, admin, admin_token = await _create_hotel_and_admin(db)
    admin_h = {"Authorization": f"Bearer {admin_token}"}

    client_id, _, _ = await _create_integration(client, hotel.id, admin_h)

    r = await _get_integration_token(client, client_id, "WRONG_SECRET")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_integration_token_invalid_client_id(client: AsyncClient, db):
    r = await _get_integration_token(client, "nonexistent_client", "fakesecret")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_revoked_integration_cannot_get_token(client: AsyncClient, db):
    hotel, admin, admin_token = await _create_hotel_and_admin(db)
    admin_h = {"Authorization": f"Bearer {admin_token}"}

    client_id, client_secret, int_id = await _create_integration(client, hotel.id, admin_h)

    # Revoke
    r = await client.delete(
        f"/api/v1/hotels/{hotel.id}/integrations/{int_id}/revoke", headers=admin_h
    )
    assert r.status_code == 200

    # Try to get token → should fail
    r = await _get_integration_token(client, client_id, client_secret)
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_integration_allowed_scope(client: AsyncClient, db):
    hotel, admin, admin_token = await _create_hotel_and_admin(db)
    admin_h = {"Authorization": f"Bearer {admin_token}"}

    # Create room type for context
    rt = await client.post(
        f"/api/v1/hotels/{hotel.id}/room-types",
        json={"name": "Standard", "capacity": 2, "base_rate": 99.0}, headers=admin_h,
    )

    client_id, client_secret, _ = await _create_integration(
        client, hotel.id, admin_h, scopes=["READ_ROOMS", "READ_ROOM_TYPES", "READ_AVAILABILITY"]
    )
    token_r = await _get_integration_token(client, client_id, client_secret)
    assert token_r.status_code == 200
    int_token = token_r.json()["access_token"]
    int_h = {"Authorization": f"Bearer {int_token}"}

    # READ_ROOMS allowed
    r = await client.get(f"/api/v1/hotels/{hotel.id}/rooms", headers=int_h)
    assert r.status_code == 200

    # READ_AVAILABILITY allowed
    r = await client.get(
        f"/api/v1/hotels/{hotel.id}/availability",
        params={"check_in_date": "2030-01-01", "check_out_date": "2030-01-03"},
        headers=int_h,
    )
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_integration_denied_scope(client: AsyncClient, db):
    """Integration with READ_RESERVATIONS but NOT CANCEL_RESERVATIONS — cancel should 403."""
    hotel, admin, admin_token = await _create_hotel_and_admin(db)
    admin_h = {"Authorization": f"Bearer {admin_token}"}

    rt = await client.post(
        f"/api/v1/hotels/{hotel.id}/room-types",
        json={"name": "Standard", "capacity": 2, "base_rate": 99.0}, headers=admin_h,
    )
    rt_id = rt.json()["id"]
    await client.post(
        f"/api/v1/hotels/{hotel.id}/rooms",
        json={"room_number": "101", "room_type_id": rt_id, "floor": 1}, headers=admin_h,
    )
    guest = await client.post(
        f"/api/v1/hotels/{hotel.id}/guests",
        json={"first_name": "Test", "last_name": "Guest"}, headers=admin_h,
    )
    guest_id = guest.json()["id"]

    # Only READ + CREATE scopes, NOT CANCEL
    client_id, client_secret, _ = await _create_integration(
        client, hotel.id, admin_h,
        scopes=["READ_RESERVATIONS", "CREATE_RESERVATIONS"],
    )
    token_r = await _get_integration_token(client, client_id, client_secret)
    int_token = token_r.json()["access_token"]
    int_h = {"Authorization": f"Bearer {int_token}"}

    # Create a reservation via integration (allowed)
    res = await client.post(
        f"/api/v1/hotels/{hotel.id}/reservations",
        json={
            "guest_id": guest_id,
            "room_type_id": rt_id,
            "check_in_date": "2030-10-01",
            "check_out_date": "2030-10-03",
        },
        headers=int_h,
    )
    assert res.status_code == 201
    res_id = res.json()["id"]

    # Cancel (NOT allowed — scope missing)
    cancel = await client.post(
        f"/api/v1/hotels/{hotel.id}/reservations/{res_id}/cancel", headers=int_h
    )
    assert cancel.status_code == 403


@pytest.mark.asyncio
async def test_integration_cross_property_denied(client: AsyncClient, db):
    """Integration for hotel 1 cannot access hotel 2."""
    from app.models import Hotel

    hotel, admin, admin_token = await _create_hotel_and_admin(db)
    admin_h = {"Authorization": f"Bearer {admin_token}"}

    hotel2 = Hotel(name="Hotel 2", address="2 Other St", phone="+1-000", email="h2@h.com")
    db.add(hotel2)
    await db.commit()

    client_id, client_secret, _ = await _create_integration(
        client, hotel.id, admin_h, scopes=["READ_ROOMS"]
    )
    token_r = await _get_integration_token(client, client_id, client_secret)
    int_token = token_r.json()["access_token"]
    int_h = {"Authorization": f"Bearer {int_token}"}

    # Access hotel 2 rooms → should fail (cross-property)
    r = await client.get(f"/api/v1/hotels/{hotel2.id}/rooms", headers=int_h)
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_integration_secret_shown_once(client: AsyncClient, db):
    """After creation, the secret must not appear in GET response."""
    hotel, admin, admin_token = await _create_hotel_and_admin(db)
    admin_h = {"Authorization": f"Bearer {admin_token}"}

    client_id, client_secret, int_id = await _create_integration(client, hotel.id, admin_h)

    # GET integration — secret must NOT appear
    r = await client.get(f"/api/v1/hotels/{hotel.id}/integrations", headers=admin_h)
    assert r.status_code == 200
    integrations = r.json()
    assert len(integrations) == 1
    integration_data = integrations[0]
    assert "client_secret" not in integration_data
    assert "client_secret_hash" not in integration_data


@pytest.mark.asyncio
async def test_rotate_integration_secret(client: AsyncClient, db):
    """After rotation, old secret is invalid, new one works."""
    hotel, admin, admin_token = await _create_hotel_and_admin(db)
    admin_h = {"Authorization": f"Bearer {admin_token}"}

    client_id, old_secret, int_id = await _create_integration(client, hotel.id, admin_h)

    # Rotate
    rotate_r = await client.post(
        f"/api/v1/hotels/{hotel.id}/integrations/{int_id}/rotate", headers=admin_h
    )
    assert rotate_r.status_code == 200
    new_secret = rotate_r.json()["client_secret"]
    assert new_secret != old_secret

    # Old secret invalid
    old_r = await _get_integration_token(client, client_id, old_secret)
    assert old_r.status_code == 401

    # New secret valid
    new_r = await _get_integration_token(client, client_id, new_secret)
    assert new_r.status_code == 200

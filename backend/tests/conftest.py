"""
Shared pytest fixtures for Hotel PMS tests.
"""

import asyncio
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.main import app
from app.db.base import Base
from app.db.session import get_db
from app.models import Hotel, Staff
from app.core.security import get_password_hash
from app.core.permissions import get_default_permissions, StaffRole
from app.core.limiter import limiter

# Disable rate limiting during tests
limiter.enabled = False

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(TEST_DB_URL, echo=False)
TestSessionLocal = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


async def override_get_db():
    async with TestSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


app.dependency_overrides[get_db] = override_get_db


@pytest_asyncio.fixture(scope="function", autouse=True)
async def reset_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield


@pytest_asyncio.fixture
async def db():
    async with TestSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac


async def _create_hotel_and_admin(db: AsyncSession) -> tuple[Hotel, Staff, str]:
    """Helper: create a hotel + PMS admin + return admin token."""
    from httpx import AsyncClient, ASGITransport

    hotel = Hotel(
        name="Test Grand Hotel",
        address="1 Test Street",
        phone="+1-555-0001",
        email="test@hotel.com",
        timezone="UTC",
        currency="USD",
    )
    db.add(hotel)
    await db.flush()

    admin = Staff(
        hotel_id=None,
        first_name="Admin",
        last_name="Test",
        email="admin@test.com",
        hashed_password=get_password_hash("Admin@123"),
        role="PMS_ADMIN",
    )
    admin.permissions_list = get_default_permissions(StaffRole.PMS_ADMIN)
    db.add(admin)
    await db.commit()

    # Get token
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        resp = await ac.post("/api/v1/auth/login", json={"email": "admin@test.com", "password": "Admin@123"})
        token = resp.json()["access_token"]

    return hotel, admin, token


async def _create_hotel_staff(db: AsyncSession, hotel_id: int, role: str, email: str) -> tuple[Staff, str]:
    """Helper: create a staff member and return their token."""
    from httpx import AsyncClient, ASGITransport

    staff_role = StaffRole(role)
    staff = Staff(
        hotel_id=hotel_id,
        first_name="Test",
        last_name=role.capitalize(),
        email=email,
        hashed_password=get_password_hash("Staff@123"),
        role=role,
    )
    staff.permissions_list = get_default_permissions(staff_role)
    db.add(staff)
    await db.commit()

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        resp = await ac.post("/api/v1/auth/login", json={"email": email, "password": "Staff@123"})
        token = resp.json()["access_token"]

    return staff, token


@pytest_asyncio.fixture
async def hotel_and_admin(db):
    return await _create_hotel_and_admin(db)


@pytest_asyncio.fixture
async def hotel_id(hotel_and_admin):
    hotel, admin, token = hotel_and_admin
    return hotel.id


@pytest_asyncio.fixture
async def admin_token(hotel_and_admin):
    hotel, admin, token = hotel_and_admin
    return token


@pytest_asyncio.fixture
async def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}

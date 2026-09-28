import secrets
import hashlib
import hmac
import bcrypt
from datetime import datetime, timedelta
from typing import Optional

from jose import JWTError, jwt

from .config import settings


# ─────────────────────────────────────────────
# Password helpers
# ─────────────────────────────────────────────

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        hashed_password.encode("utf-8")
    )


def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


# ─────────────────────────────────────────────
# JWT helpers
# ─────────────────────────────────────────────

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire, "token_type": "staff"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_integration_token(
    integration_id: int,
    hotel_id: int,
    scopes: list[str],
) -> str:
    expire = datetime.utcnow() + timedelta(
        minutes=settings.INTEGRATION_TOKEN_EXPIRE_MINUTES
    )
    payload = {
        "sub": str(integration_id),
        "hotel_id": hotel_id,
        "scopes": scopes,
        "token_type": "integration",
        "exp": expire,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])


# ─────────────────────────────────────────────
# Integration credential helpers
# ─────────────────────────────────────────────

def generate_client_id() -> str:
    """Generate a unique client_id for an integration."""
    return f"pms_{secrets.token_hex(16)}"


def generate_client_secret() -> tuple[str, str]:
    """
    Generate a (plain_secret, hashed_secret) pair.
    The plain secret is shown ONCE to the admin at creation.
    Only the hash is stored in the database.
    """
    plain = secrets.token_urlsafe(48)
    hashed = _hash_secret(plain)
    return plain, hashed


def verify_client_secret(plain: str, hashed: str) -> bool:
    """Verify an integration client secret against its stored hash using constant-time comparison."""
    return hmac.compare_digest(_hash_secret(plain), hashed)


def _hash_secret(plain: str) -> str:
    return hashlib.sha256(plain.encode("utf-8")).hexdigest()

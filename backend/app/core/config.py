from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "Hotel PMS"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # Security
    SECRET_KEY: str = "hotel-pms-super-secret-key-change-this-in-production-2024"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8 hours
    INTEGRATION_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    RATE_LIMITING_ENABLED: bool = True
    LOGIN_RATE_LIMIT: str = "10/minute"

    # Database — relative path; resolves to backend/pms.db when running from backend/
    DATABASE_URL: str = "sqlite+aiosqlite:///./pms.db"

    # CORS
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:5174",
        "http://localhost:3000",
        "http://127.0.0.1:5174",
    ]

    # First Admin Bootstrap
    FIRST_ADMIN_EMAIL: str = "admin@hotelpms.com"
    FIRST_ADMIN_PASSWORD: str = "Admin@123!"
    FIRST_ADMIN_FIRST_NAME: str = "PMS"
    FIRST_ADMIN_LAST_NAME: str = "Administrator"

    # Default Hotel Bootstrap
    FIRST_HOTEL_NAME: str = "Grand Azure Hotel"
    FIRST_HOTEL_ADDRESS: str = "123 Ocean Drive, Miami Beach, FL 33139"
    FIRST_HOTEL_PHONE: str = "+1-305-555-0100"
    FIRST_HOTEL_EMAIL: str = "info@grandazure.com"
    FIRST_HOTEL_TIMEZONE: str = "America/New_York"
    FIRST_HOTEL_CURRENCY: str = "USD"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()

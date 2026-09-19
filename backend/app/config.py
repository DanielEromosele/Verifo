"""Application configuration with PostgreSQL -> SQLite fallback.

The platform targets PostgreSQL in production, but on machines without a
PostgreSQL server it transparently falls back to a local SQLite database.
All models are written against portable SQLAlchemy types so the swap is a
single configuration change (no model drift).
"""
import os
import warnings
from datetime import timedelta
from pathlib import Path

import sqlalchemy as sa

BASE_DIR = Path(__file__).resolve().parent.parent
INSTANCE_DIR = BASE_DIR / "instance"
INSTANCE_DIR.mkdir(parents=True, exist_ok=True)  # SQLite needs the directory present
DEFAULT_SQLITE_URL = "sqlite:///" + str(INSTANCE_DIR / "verifo.db")


def _load_dotenv():
    """Load backend/.env into the process environment if present."""
    try:
        from dotenv import load_dotenv
        load_dotenv(BASE_DIR / ".env")
    except Exception:
        pass


_load_dotenv()


def resolve_database_url() -> str:
    """Return the effective SQLAlchemy database URL.

    Priority:
      1. Explicit SQLite URL in DATABASE_URL -> used as-is.
      2. PostgreSQL (or other) URL in DATABASE_URL -> verify connectivity;
         fall back to SQLite only if unreachable.
      3. No DATABASE_URL -> SQLite default.
    """
    requested = (os.environ.get("DATABASE_URL") or "").strip()
    if not requested:
        warnings.warn(
            "DATABASE_URL is not set - using SQLite fallback.",
            RuntimeWarning,
        )
        return DEFAULT_SQLITE_URL

    if requested.startswith("sqlite"):
        return requested

    if os.environ.get("VERIFO_FORCE_POSTGRES") == "1":
        return requested

    try:
        engine = sa.create_engine(requested, connect_args={"connect_timeout": 3})
        with engine.connect() as conn:
            conn.execute(sa.text("SELECT 1"))
        engine.dispose()
        return requested
    except Exception as exc:  # noqa: BLE001 - fallback is intentional behaviour
        warnings.warn(
            f"Configured database is unreachable ({exc}). "
            "Falling back to SQLite for local development. "
            "Set VERIFO_FORCE_POSTGRES=1 to disable fallback.",
            RuntimeWarning,
        )
        return DEFAULT_SQLITE_URL


class BaseConfig:
    """Base configuration shared by all environments."""

    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-me-0000-32bytes")
    VERIFO_ENV = os.environ.get("VERIFO_ENV", "development")

    # --- Database ---
    SQLALCHEMY_DATABASE_URI = resolve_database_url()
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True}

    # --- Paths ---
    BASE_DIR = BASE_DIR
    INSTANCE_DIR = INSTANCE_DIR
    STORAGE_DIR = Path(os.environ.get("VERIFO_STORAGE", "storage"))
    if not STORAGE_DIR.is_absolute():
        STORAGE_DIR = BASE_DIR / STORAGE_DIR
    STORAGE_ENCRYPT = os.environ.get("VERIFO_STORAGE_ENCRYPT") == "1"
    STORAGE_KEY = os.environ.get("VERIFO_STORAGE_KEY") or ""

    # --- Auth / JWT ---
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(
        hours=int(os.environ.get("JWT_ACCESS_TOKEN_EXPIRES_HOURS", "12"))
    )
    JWT_IDENTITY_CLAIM = "sub"
    JWT_ERROR_MESSAGE_KEY = "message"

    # --- Upload policy ---
    MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50 MB request cap
    ALLOWED_DOCUMENT_TYPES = {"pdf", "png", "jpg", "jpeg", "zip"}
    MAX_REFERENCE_SIZE = 20 * 1024 * 1024
    MAX_UPLOAD_ITEM_SIZE = 15 * 1024 * 1024
    MAX_ZIP_FILES = 1000
    MAX_ZIP_SIZE = 40 * 1024 * 1024

    # --- Rate limiting ---
    RATELIMIT_ENABLED = True
    RATELIMIT_STRATEGY = "moving-window"
    RATELIMIT_STORAGE_URI = "memory://"
    RATELIMIT_DEFAULT = "200 per hour"

    # --- Download token ---
    DOWNLOAD_SECRET = os.environ.get(
        "VERIFO_DOWNLOAD_SECRET", SECRET_KEY
    )
    DOWNLOAD_TOKEN_TTL = timedelta(minutes=15)

    @staticmethod
    def default_verification_config() -> dict:
        """Documented default weight/threshold configuration."""
        return {
            "weights": {
                "ocr": 0.25,
                "database": 0.25,
                "reference": 0.30,
                "integrity": 0.20,
            },
            "thresholds": {
                "verified_min": 80,
                "review_min": 50,
            },
            "required_fields": [],
        }


class DevelopmentConfig(BaseConfig):
    DEBUG = True


class TestingConfig(BaseConfig):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    RATELIMIT_ENABLED = False
    WTF_CSRF_ENABLED = False


class ProductionConfig(BaseConfig):
    DEBUG = False
    RATELIMIT_STORAGE_URI = "memory://"


CONFIG_MAP = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
}
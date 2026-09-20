"""Environment-specific configuration classes."""
import os

from .base import BaseConfig


class DevelopmentConfig(BaseConfig):
    DEBUG = True
    # In development, default database URL is SQLite unless DATABASE_URL set.
    # VERIFO_FORCE_POSTGRES=1 makes PostgreSQL strictly required (no fallback):
    # the app must never silently drop to SQLite in a deployed environment.
    if os.environ.get("VERIFO_FORCE_POSTGRES") == "1":
        _strict_db_url = os.environ.get("DATABASE_URL", "").strip()
        if not _strict_db_url.startswith("postgres"):
            raise RuntimeError(
                "VERIFO_FORCE_POSTGRES=1 requires a PostgreSQL DATABASE_URL."
            )
        SQLALCHEMY_DATABASE_URI = _strict_db_url
    else:
        SQLALCHEMY_DATABASE_URI = os.environ.get(
            "DATABASE_URL",
            BaseConfig.SQLALCHEMY_DATABASE_URI or f"sqlite:///{BaseConfig.INSTANCE_DIR / 'verifo.db'}",
        )


class TestingConfig(BaseConfig):
    TESTING = True
    RATELIMIT_ENABLED = False
    DEMO_AUTH_ENABLED = False
    # Each test sets its own temp-file SQLite URI via the app factory override.
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL", "sqlite:///:memory:"
    )
    STORAGE_DIR = BaseConfig.BASE_DIR / "storage" / "test"
    WTF_CSRF_ENABLED = False


class ProductionConfig(BaseConfig):
    DEBUG = False
    STORAGE_ENCRYPT = True
    DEMO_AUTH_ENABLED = False

    def __init__(self):
        if not os.environ.get("DATABASE_URL"):
            raise RuntimeError("DATABASE_URL must be set in production.")
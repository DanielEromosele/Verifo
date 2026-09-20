"""Environment-specific configuration classes."""
import os

from .base import BaseConfig


def resolve_dev_database_uri() -> str:
    """Resolve the development database URI (never a silent SQLite default).

    Priority:
      1. PostgreSQL DATABASE_URL -> used as-is.
      2. VERIFO_FORCE_POSTGRES=1  -> '' (must be PostgreSQL; create_app rejects '').
      3. VERIFO_ALLOW_SQLITE=1    -> local SQLite dev opt-in.
      4. otherwise                -> '' (create_app rejects: no database).
    """
    url = os.environ.get("DATABASE_URL", "").strip()
    if url:
        return url if url.startswith("postgres") else ""
    if os.environ.get("VERIFO_FORCE_POSTGRES") == "1":
        return ""
    if os.environ.get("VERIFO_ALLOW_SQLITE") == "1":
        return (
            BaseConfig.SQLALCHEMY_DATABASE_URI
            or f"sqlite:///{BaseConfig.INSTANCE_DIR / 'verifo.db'}"
        )
    return ""


class DevelopmentConfig(BaseConfig):
    DEBUG = True
    # SQLite is NEVER a default. A deployed app (Render) sets no
    # VERIFO_ALLOW_SQLITE, so it can never silently open instance/verifo.db —
    # '' here means create_app raises until a PostgreSQL DATABASE_URL is set.
    SQLALCHEMY_DATABASE_URI = resolve_dev_database_uri()


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
    # PostgreSQL only. BaseConfig yields DATABASE_URL or ''; create_app rejects
    # anything that is not postgres/sqlite (and '' always).
    SQLALCHEMY_DATABASE_URI = BaseConfig.SQLALCHEMY_DATABASE_URI

    def __init__(self):
        url = os.environ.get("DATABASE_URL", "") or ""
        if not url:
            raise RuntimeError("DATABASE_URL must be set in production.")
        if not url.startswith("postgres"):
            raise RuntimeError("Production requires a PostgreSQL DATABASE_URL.")
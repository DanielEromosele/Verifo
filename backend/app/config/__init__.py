"""Central configuration package.

Layered configuration supporting Development / Testing / Production. All
values come from the environment (see backend/.env.example) — nothing is
hardcoded except safe development defaults. The production configuration
requires DATABASE_URL explicitly (no silent fallback).

Example usage:
    from app.config import BaseConfig, CONFIG_MAP, resolve_database_url
"""
import os
import warnings
from pathlib import Path

import sqlalchemy as sa

def _load_dotenv():
    """Load backend/.env into the process environment if present."""
    try:
        from dotenv import load_dotenv

        load_dotenv(BASE_DIR / ".env")
    except Exception:  # noqa: BLE001 - dotenv is optional tooling
        pass


# base is env-agnostic and must be imported first (define BASE_DIR).
from .base import BaseConfig, BASE_DIR, INSTANCE_DIR  # noqa: E402

# Load .env AFTER BASE_DIR resolves, but BEFORE environments build their
# class attributes (DATABASE_URL / VERIFO_ALLOW_SQLITE must be visible).
_load_dotenv()
from .environments import DevelopmentConfig, ProductionConfig, TestingConfig  # noqa: E402

DEFAULT_SQLITE_URL = f"sqlite:///{INSTANCE_DIR / 'verifo.db'}"

CONFIG_MAP = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
}


def require_database(uri: str) -> str:
    """Validate a configured SQLALCHEMY_DATABASE_URI.

    Accepts PostgreSQL and SQLite URLs; rejects empty/garbage so a deployed
    app can never limp along without a real database.
    """
    uri = (uri or "").strip()
    if uri.startswith("postgres") or uri.startswith("sqlite"):
        return uri
    raise RuntimeError(
        "No usable database configured. Set DATABASE_URL to a PostgreSQL URL "
        "(for local SQLite dev, set VERIFO_ALLOW_SQLITE=1)."
    )


def resolve_database_url(requested: str = "") -> str:
    """Resolve the effective SQLAlchemy database URL.

    Priority:
      1. Explicit SQLite URL in DATABASE_URL -> used as-is.
      2. PostgreSQL (or other) URL in DATABASE_URL -> verify connectivity;
         fall back to SQLite only if unreachable.
      3. No DATABASE_URL -> SQLite default.
    """
    requested = (requested or os.environ.get("DATABASE_URL") or "").strip()
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
    except Exception as exc:  # noqa: BLE001 - fallback is intentional
        warnings.warn(
            f"Configured database is unreachable ({exc}); falling back to SQLite. "
            "Set VERIFO_FORCE_POSTGRES=1 to disable fallback.",
            RuntimeWarning,
        )
        return DEFAULT_SQLITE_URL


__all__ = [
    "BaseConfig",
    "CONFIG_MAP",
    "DevelopmentConfig",
    "TestingConfig",
    "ProductionConfig",
    "resolve_database_url",
    "require_database",
    "DEFAULT_SQLITE_URL",
]
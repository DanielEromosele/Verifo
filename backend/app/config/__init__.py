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

from .base import BaseConfig, BASE_DIR, INSTANCE_DIR
from .environments import DevelopmentConfig, ProductionConfig, TestingConfig

DEFAULT_SQLITE_URL = f"sqlite:///{INSTANCE_DIR / 'verifo.db'}"

CONFIG_MAP = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
}


def _load_dotenv():
    """Load backend/.env into the process environment if present."""
    try:
        from dotenv import load_dotenv

        load_dotenv(BASE_DIR / ".env")
    except Exception:  # noqa: BLE001 - dotenv is optional tooling
        pass


_load_dotenv()


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
    "DEFAULT_SQLITE_URL",
]
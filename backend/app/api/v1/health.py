"""Health + readiness endpoints."""
from flask import Blueprint, current_app

from ...extensions import db
from ...utils.response import api_ok

health_bp = Blueprint("health", __name__)


def _db_ok() -> bool:
    try:
        db.session.execute(db.text("SELECT 1"))
        return True
    except Exception:  # noqa: BLE001
        return False


@health_bp.get("")
def health():
    db_ok = _db_ok()
    return (
        api_ok(
            {
                "status": "ok" if db_ok else "degraded",
                "service": "verifo-backend",
                "database": "ok" if db_ok else "unavailable",
                "env": current_app.config.get("VERIFO_ENV"),
                "api_version": "v1",
            }
        ),
        200 if db_ok else 503,
    )
"""Organization API keys for the external verification API (Phase 7).

Only a SHA-256 digest of the key is stored; the raw value is returned to the
client exactly once at creation. Keys are tenant-scoped and never proxied to
the frontend.
"""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from ..extensions import db
from .common import PkUuidMixin, StatusCode, TimestampsMixin, model_enum, utcnow


def _hash_key(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _aware(dt) -> datetime | None:
    """SQLite round-trips tz-aware datetimes as naive; normalize before comparing."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


class APIKey(db.Model, PkUuidMixin, TimestampsMixin):
    __tablename__ = "api_keys"

    organization_id = db.Column(db.String(36), db.ForeignKey("organizations.id"), nullable=False, index=True)
    name = db.Column(db.String(200), nullable=False)
    prefix = db.Column(db.String(12), nullable=False)          # first chars of the secret, for display
    key_digest = db.Column(db.String(64), unique=True, nullable=False)
    status = db.Column(model_enum(StatusCode), default=StatusCode.ACTIVE, nullable=False)
    expires_at = db.Column(db.DateTime(timezone=True), nullable=True)
    last_used_at = db.Column(db.DateTime(timezone=True), nullable=True)
    created_by = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=True)

    @classmethod
    def generate(cls, organization_id: str, name: str, created_by: str | None, ttl_days: int | None = None):
        raw = f"vf_{secrets.token_urlsafe(32)}"
        key = cls(
            organization_id=organization_id,
            name=name,
            prefix=raw[:10],
            key_digest=_hash_key(raw),
            created_by=created_by,
        )
        if ttl_days:
            key.expires_at = datetime.now(timezone.utc) + timedelta(days=ttl_days)
        return key, raw

    @classmethod
    def verify(cls, raw: str) -> "APIKey | None":
        digest = _hash_key(raw)
        key = cls.query.filter(db.func.lower(cls.key_digest) == digest).first()
        if not key or key.status != StatusCode.ACTIVE:
            return None
        expires = _aware(key.expires_at)
        if expires and expires < utcnow():
            return None
        key.last_used_at = utcnow()
        return key

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "prefix": self.prefix,
            "status": self.status.value if self.status else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "last_used_at": self.last_used_at.isoformat() if self.last_used_at else None,
        }
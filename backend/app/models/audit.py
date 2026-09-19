"""Immutable audit log model.

AuditLog rows are append-only. The application exposes NO update or delete
paths for this table, and tests assert that a request attempting mutation
fails. Before/after snapshots are stored as JSON for searchable history.
"""
from ..extensions import db
from .common import PkUuidMixin, TimestampsMixin


class AuditLog(db.Model, PkUuidMixin, TimestampsMixin):
    __tablename__ = "audit_logs"
    __table_args__ = (
        db.Index("ix_audit_org_created", "organization_id", "created_at"),
    )

    organization_id = db.Column(db.String(36), db.ForeignKey("organizations.id"), nullable=True, index=True)
    actor_user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=True)
    actor_name = db.Column(db.String(200), nullable=True)

    action = db.Column(db.String(100), nullable=False)          # e.g. USER_LOGIN, VERIFICATION_DECISION
    entity_type = db.Column(db.String(100), nullable=True)      # e.g. Verification, ReferenceDocument
    entity_id = db.Column(db.String(36), nullable=True)

    summary = db.Column(db.String(500), nullable=True)
    before = db.Column(db.JSON, nullable=True)
    after = db.Column(db.JSON, nullable=True)

    ip_address = db.Column(db.String(64), nullable=True)
    user_agent = db.Column(db.String(300), nullable=True)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "organization_id": self.organization_id,
            "actor_user_id": self.actor_user_id,
            "actor_name": self.actor_name,
            "action": self.action,
            "entity_type": self.entity_type,
            "entity_id": self.entity_id,
            "summary": self.summary,
            "before": self.before,
            "after": self.after,
            "ip_address": self.ip_address,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
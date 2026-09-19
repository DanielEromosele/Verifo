"""Organization + membership (tenant boundary) models.

Every business record in the platform belongs to an Organization. Memberships
link a global User to an Organization with a RoleCode (SUBMITTER/OPERATOR/ADMIN).
"""
import re
from sqlalchemy.orm import validates

from ..extensions import db
from .common import PkUuidMixin, RoleCode, StatusCode, TimestampsMixin, model_enum

SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$")


def default_verification_config() -> dict:
    from ..config import BaseConfig

    return BaseConfig.default_verification_config()


class Organization(db.Model, PkUuidMixin, TimestampsMixin):
    __tablename__ = "organizations"

    name = db.Column(db.String(200), nullable=False)
    slug = db.Column(db.String(64), unique=True, index=True, nullable=False)
    industry = db.Column(db.String(120), nullable=True)
    logo_path = db.Column(db.String(500), nullable=True)
    status = db.Column(model_enum(StatusCode), default=StatusCode.ACTIVE, nullable=False)
    verification_config = db.Column(db.JSON, default=default_verification_config, nullable=False)
    settings = db.Column(db.JSON, default=dict, nullable=False)

    memberships = db.relationship(
        "Membership",
        back_populates="organization",
        cascade="all, delete-orphan",
        lazy="dynamic",
    )
    # NOTE: `references` relationship to ReferenceDocument is added in Phase 2
    # alongside the ReferenceDocument model itself.

    @validates("slug")
    def _validate_slug(self, key, value):
        value = (value or "").strip().lower()
        if not SLUG_RE.match(value):
            raise ValueError("Invalid slug: use 3-64 lowercase letters, digits, or single hyphens.")
        return value

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "slug": self.slug,
            "industry": self.industry,
            "status": self.status.value if self.status else None,
            "verification_config": self.verification_config,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Membership(db.Model, PkUuidMixin, TimestampsMixin):
    """A User's role within an Organization. Alias: the 'Operator' record."""
    __tablename__ = "memberships"
    __table_args__ = (
        db.UniqueConstraint("user_id", "organization_id", name="uq_membership_user_org"),
    )

    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    organization_id = db.Column(db.String(36), db.ForeignKey("organizations.id"), nullable=False)
    role = db.Column(model_enum(RoleCode), default=RoleCode.SUBMITTER, nullable=False)
    status = db.Column(model_enum(StatusCode), default=StatusCode.ACTIVE, nullable=False)
    permissions = db.Column(db.JSON, default=list, nullable=False)

    user = db.relationship("User", back_populates="memberships", lazy="joined")
    organization = db.relationship("Organization", back_populates="memberships", lazy="joined")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "organization": self.organization.to_dict() if self.organization else None,
            "role": self.role.value if self.role else None,
            "status": self.status.value if self.status else None,
            "permissions": self.permissions or [],
        }
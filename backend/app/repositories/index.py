"""Concrete repositories."""

from ..extensions import db
from ..models.audit import AuditLog
from ..models.organization import Membership, Organization
from ..models.user import User
from .base import GlobalRepository, TenantRepository, tenant_scope


class OrganizationRepository(GlobalRepository):
    model = Organization

    def get_by_slug(self, slug: str):
        return Organization.query.filter_by(slug=slug).first()


class UserRepository(GlobalRepository):
    model = User

    def get_by_email(self, email: str):
        return User.query.filter_by(email=email.lower()).first()

    def create_user(self, email: str, full_name: str, password: str) -> User:
        user = User(email=email, full_name=full_name)
        user.set_password(password)
        db.session.add(user)
        return user


class MembershipRepository(TenantRepository):
    model = Membership

    def can_access(self, user_id: str, organization_id: str) -> bool:
        return (
            Membership.query.filter_by(user_id=user_id, organization_id=organization_id).first()
            is not None
        )


class AuditLogRepository(TenantRepository):
    model = AuditLog

    def list(
        self,
        organization_id: str,
        *,
        limit: int = 200,
        offset: int = 0,
        action: str | None = None,
    ) -> list[AuditLog]:
        q = tenant_scope(AuditLog, organization_id)
        if action:
            q = q.filter(AuditLog.action == action)
        return q.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit).all()
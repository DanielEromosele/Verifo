"""Audit logging service.

Append-only by design: callers create audit rows via record(); there is no
update or delete path anywhere in the codebase for AuditLog rows. Keeps
queries tenant-scoped so one organization can never read another's trail.
"""
from flask import has_request_context, request

from ..extensions import db
from ..models.audit import AuditLog


def _request_ip() -> str | None:
    return request.remote_addr if has_request_context() else None


def _request_ua() -> str | None:
    if not has_request_context() or not request.user_agent:
        return None
    return request.user_agent.string[:300]


class AuditService:
    @staticmethod
    def record(
        *,
        organization_id: str | None,
        action: str,
        entity_type: str | None = None,
        entity_id: str | None = None,
        summary: str | None = None,
        before: dict | None = None,
        after: dict | None = None,
        actor_user_id: str | None = None,
        actor_name: str | None = None,
    ) -> AuditLog:
        entry = AuditLog(
            organization_id=organization_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            summary=summary,
            before=before,
            after=after,
            actor_user_id=actor_user_id,
            actor_name=actor_name,
            ip_address=_request_ip(),
            user_agent=_request_ua(),
        )
        db.session.add(entry)
        return entry

    @staticmethod
    def commit(*, organization_id, action, **kwargs) -> AuditLog:
        entry = AuditService.record(organization_id=organization_id, action=action, **kwargs)
        db.session.flush()
        return entry

    @staticmethod
    def list_for_org(organization_id: str, *, limit=200, offset=0, action=None) -> list[AuditLog]:
        q = AuditLog.query.filter(AuditLog.organization_id == organization_id)
        if action:
            q = q.filter(AuditLog.action == action)
        return (
            q.order_by(AuditLog.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )


def record_login_failure(email: str, reason: str, organization_id: str | None = None) -> None:
    AuditService.record(
        organization_id=organization_id,
        action="AUTH_LOGIN_FAILURE",
        entity_type="User",
        summary=f"Login failed for {email}: {reason}",
    )
"""Organization members list + admin management of operators.

Phase 1 provides read + invite; Phase 6 adds suspend and permissions.
"""
from flask import Blueprint, request

from ...auth import require_org, roles_required
from ...extensions import db
from ...models.common import RoleCode
from ...repositories.index import MembershipRepository, UserRepository
from ...schemas import InviteSchema
from ...services.audit import AuditService
from ...utils.response import api_error, api_ok

users_bp = Blueprint("users", __name__)


@users_bp.get("")
@roles_required(RoleCode.ADMIN.value, RoleCode.OPERATOR.value)
def list_users():
    memberships = MembershipRepository().list(require_org())
    memberships.sort(key=lambda m: m.created_at)
    result = []
    for m in memberships:
        entry = m.to_dict()
        entry["user"] = m.user.to_dict() if m.user else None
        result.append(entry)
    return api_ok({"users": result}), 200


@users_bp.post("/invite")
@roles_required(RoleCode.ADMIN.value)
def invite_user():
    """Create/attach a user to the current organization with a role."""
    org_id = require_org()
    data = request.get_json(silent=True) or {}
    payload = {
        "email": data.get("email") or "",
        "full_name": data.get("full_name") or "",
        "role": (data.get("role") or RoleCode.SUBMITTER.value).upper(),
    }
    clean = InviteSchema(payload).validate()

    user_repo = UserRepository()
    membership_repo = MembershipRepository()

    user = user_repo.get_by_email(clean["email"])
    created = False
    if not user:
        password = data.get("password") or ""
        if len(password) < 8:
            return api_error(
                "INVALID_INPUT",
                "A password of at least 8 characters is required for a new user.",
            )
        user = user_repo.create_user(clean["email"], clean["full_name"], password)
        db.session.flush()
        created = True

    existing_by_org = (
        membership_repo.list(org_id, user_id=user.id) or [None]
    )[0]
    membership = existing_by_org
    if membership:
        from ...models.common import StatusCode

        membership.role = RoleCode(clean["role"])
        membership.status = StatusCode.ACTIVE
    else:
        from ...models.organization import Membership

        membership = Membership(
            user_id=user.id, organization_id=org_id, role=RoleCode(clean["role"])
        )
        db.session.add(membership)

    AuditService.commit(
        organization_id=org_id,
        action="MEMBER_INVITED",
        entity_type="Membership",
        summary=f"{clean['email']} added as {clean['role']}.",
        after={"email": clean["email"], "role": clean["role"]},
    )
    db.session.commit()
    return (
        api_ok(
            {
                "user": user.to_dict(),
                "membership": membership.to_dict(),
                "created": created,
            }
        ),
        201 if created else 200,
    )
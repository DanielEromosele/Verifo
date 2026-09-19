"""Organization members list + admin management of operators.

Phase 1 provides read; Phase 6 adds add/suspend/permissions management.
"""
from flask import Blueprint, jsonify, request

from ..extensions import db
from ..models.common import RoleCode
from ..models.organization import Membership
from ..models.user import User
from ..rbac import current_org_id, roles_required
from ..services.audit import AuditService

users_bp = Blueprint("users", __name__)


@users_bp.get("")
@roles_required(RoleCode.ADMIN.value, RoleCode.OPERATOR.value)
def list_users():
    org_id = current_org_id()
    memberships = (
        Membership.query.filter_by(organization_id=org_id)
        .order_by(Membership.created_at.asc())
        .all()
    )
    result = []
    for m in memberships:
        entry = m.to_dict()
        entry["user"] = m.user.to_dict() if m.user else None
        result.append(entry)
    return jsonify({"users": result}), 200


@users_bp.post("/invite")
@roles_required(RoleCode.ADMIN.value)
def invite_user():
    """Create/attach a user to the current organization with a role."""
    org_id = current_org_id()
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    full_name = (data.get("full_name") or "").strip()
    role = (data.get("role") or RoleCode.SUBMITTER.value).upper()

    if not email or not full_name:
        return jsonify({"error": "email and full_name are required."}), 400
    try:
        RoleCode(role)
    except ValueError:
        return jsonify({"error": f"Unknown role '{role}'."}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        password = data.get("password") or ""
        if len(password) < 8:
            return jsonify({"error": "password of at least 8 characters is required for a new user."}), 400
        user = User(email=email, full_name=full_name)
        user.set_password(password)
        db.session.add(user)
        db.session.flush()

    existing = Membership.query.filter_by(user_id=user.id, organization_id=org_id).first()
    if existing:
        existing.role = RoleCode(role)
        membership = existing
    else:
        membership = Membership(user_id=user.id, organization_id=org_id, role=RoleCode(role))
        db.session.add(membership)

    AuditService.commit(
        organization_id=org_id,
        action="MEMBER_INVITED",
        entity_type="Membership",
        summary=f"{email} added as {role}.",
        after={"email": email, "role": role},
    )
    db.session.commit()
    return jsonify({"user": user.to_dict(), "membership": membership.to_dict()}), 201 if not existing else 200
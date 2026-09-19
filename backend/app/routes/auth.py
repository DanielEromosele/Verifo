"""Authentication and membership switching endpoints."""
import re

from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required

from ..extensions import db
from ..models.common import RoleCode, StatusCode
from ..models.organization import Membership, Organization
from ..models.user import User
from ..rbac import require_auth
from ..services.audit import AuditService

auth_bp = Blueprint("auth", __name__)


def _issue_token(user: User, membership: Membership) -> str:
    return create_access_token(
        identity=str(user.id),
        additional_claims={
            "org": membership.organization_id,
            "role": membership.role.value if membership.role else RoleCode.SUBMITTER.value,
        },
    )


@auth_bp.post("/register")
def register():
    data = request.get_json(silent=True) or {}
    org_name = (data.get("org_name") or "").strip()
    full_name = (data.get("full_name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    slug = (data.get("org_slug") or "").strip().lower() or _slugify(org_name)

    if not org_name or not full_name or not email or not password:
        return jsonify({"error": "org_name, full_name, email and password are required."}), 400
    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters."}), 400

    existing_slug = Organization.query.filter_by(slug=slug).first()
    if existing_slug:
        return jsonify({"error": "That organization slug is already taken."}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "An account with this email already exists."}), 400

    org = Organization(name=org_name, slug=slug, industry=(data.get("industry") or "").strip() or None)
    user = User(email=email, full_name=full_name)
    try:
        user.set_password(password)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    db.session.add_all([org, user])
    db.session.flush()
    membership = Membership(
        user_id=user.id,
        organization_id=org.id,
        role=RoleCode.ADMIN,
        status=StatusCode.ACTIVE,
    )
    db.session.add(membership)
    AuditService.commit(
        organization_id=org.id,
        action="ORG_CREATED",
        entity_type="Organization",
        entity_id=org.id,
        summary=f"Organization '{org.name}' created with admin {email}.",
        after={"name": org.name, "slug": org.slug, "industry": org.industry},
        actor_user_id=user.id,
        actor_name=user.full_name,
    )
    db.session.commit()

    return jsonify(
        {
            "token": _issue_token(user, membership),
            "user": user.to_dict(),
            "membership": membership.to_dict(),
        }
    ), 201


@auth_bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        AuditService.commit(
            organization_id=None,
            action="AUTH_LOGIN_FAILURE",
            entity_type="User",
            summary=f"Login failed for {email}.",
        )
        db.session.commit()
        return jsonify({"error": "Invalid email or password."}), 401
    if user.status != StatusCode.ACTIVE:
        return jsonify({"error": "This account is suspended."}), 403

    memberships = user.active_memberships()
    if not memberships:
        return jsonify({"error": "This account has no active organization membership."}), 403

    active = memberships[0] if len(memberships) == 1 else None
    user.touch_login()
    audit = AuditService.commit(
        organization_id=active.organization_id if active else None,
        action="USER_LOGIN",
        entity_type="User",
        entity_id=user.id,
        summary=f"{user.email} signed in.",
        actor_user_id=user.id,
        actor_name=user.full_name,
    )
    db.session.add(audit)
    db.session.commit()

    response = {
        "user": user.to_dict(),
        "memberships": [m.to_dict() for m in memberships],
    }
    if active:
        response["token"] = _issue_token(user, active)
        response["active_membership"] = active.to_dict()
    return jsonify(response), 200


@auth_bp.get("/me")
@require_auth
def me():
    uid = get_jwt_identity()
    user = User.query.get(uid)
    if not user:
        return jsonify({"error": "User not found."}), 404
    org_id = None
    from ..models.user import current_tenant

    tenant = current_tenant()
    org = Organization.query.get(tenant["org_id"]) if tenant else None
    user_detail = user.to_dict()
    if org:
        user_detail["organization"] = org.to_dict()
        user_detail["role"] = tenant["role"]
    return jsonify({"user": user_detail}), 200


@auth_bp.post("/switch-org")
@jwt_required()
def switch_org():
    uid = get_jwt_identity()
    data = request.get_json(silent=True) or {}
    org_id = data.get("organization_id")
    user = User.query.get(uid)
    if not user:
        return jsonify({"error": "User not found."}), 404
    membership = next(
        (m for m in user.active_memberships() if m.organization_id == org_id), None
    )
    if not membership:
        return jsonify({"error": "You are not a member of that organization."}), 403
    return jsonify({"token": _issue_token(user, membership), "membership": membership.to_dict()}), 200


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    if not slug:
        slug = "org"
    return slug[:60] or "org"
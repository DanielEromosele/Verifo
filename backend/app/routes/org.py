"""Current organization profile (admin-managed in Phase 6)."""
from flask import Blueprint, jsonify, request

from ..extensions import db
from ..models.common import RoleCode
from ..models.organization import Organization
from ..rbac import current_org_id, roles_required
from ..services.audit import AuditService

org_bp = Blueprint("org", __name__)


@org_bp.get("")
@roles_required(RoleCode.ADMIN.value, RoleCode.OPERATOR.value, RoleCode.SUBMITTER.value)
def get_org():
    org = Organization.query.get(current_org_id())
    if not org:
        return jsonify({"error": "Organization not found."}), 404
    return jsonify({"organization": org.to_dict()}), 200


@org_bp.put("")
@roles_required(RoleCode.ADMIN.value)
def update_org():
    org = Organization.query.get(current_org_id())
    if not org:
        return jsonify({"error": "Organization not found."}), 404
    data = request.get_json(silent=True) or {}
    before = org.to_dict()
    for field in ("name", "industry", "logo_path"):
        if field in data:
            setattr(org, field, (data[field] or "").strip() or None)
    db.session.flush()
    AuditService.commit(
        organization_id=org.id,
        action="ORG_UPDATED",
        entity_type="Organization",
        entity_id=org.id,
        summary=f"Organization profile updated by {org.name} admin.",
        before={"name": before.get("name"), "industry": before.get("industry")},
        after={"name": org.name, "industry": org.industry},
    )
    db.session.commit()
    return jsonify({"organization": org.to_dict()}), 200
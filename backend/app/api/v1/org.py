"""Current organization profile (admin-managed in Phase 6)."""
from flask import Blueprint, jsonify, request

from ...auth import require_org, roles_required
from ...extensions import db
from ...models.common import RoleCode
from ...repositories.index import OrganizationRepository
from ...schemas import UpdateOrganizationSchema
from ...services.audit import AuditService
from ...utils.response import api_error, api_ok

org_bp = Blueprint("org", __name__)


@org_bp.get("")
@roles_required(RoleCode.ADMIN.value, RoleCode.OPERATOR.value, RoleCode.SUBMITTER.value)
def get_org():
    org = OrganizationRepository().get_or_404(require_org())
    return api_ok({"organization": org.to_dict()}), 200


@org_bp.put("")
@roles_required(RoleCode.ADMIN.value)
def update_org():
    clean = UpdateOrganizationSchema(request.get_json(silent=True) or {}).validate()
    org = OrganizationRepository().get_or_404(require_org())
    before = org.to_dict()
    for field, value in clean.items():
        if field == "verification_config":
            merged = dict(org.verification_config or {})
            merged.update(value or {})
            org.verification_config = merged
        else:
            setattr(org, field, value.strip() or None)
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
    return api_ok({"organization": org.to_dict()}), 200
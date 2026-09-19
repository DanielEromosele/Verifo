"""Organization API keys (Phase 7). Raw keys are shown exactly once."""
from flask import Blueprint, request

from ...auth import require_org, roles_required
from ...extensions import db
from ...models.apikey import APIKey
from ...models.common import RoleCode
from ...services.audit import AuditService
from ...utils.response import api_error, api_ok

apikeys_bp = Blueprint("apikeys", __name__)


@apikeys_bp.get("")
@roles_required(RoleCode.ADMIN.value)
def list_keys():
    org_id = require_org()
    rows = APIKey.query.filter_by(organization_id=org_id).all()
    return api_ok({"api_keys": [r.to_dict() for r in rows]}), 200


@apikeys_bp.post("")
@roles_required(RoleCode.ADMIN.value)
def create_key():
    org_id = require_org()
    body = request.get_json(silent=True) or {}
    name = (body.get("name") or "").strip()
    if not name:
        return api_error("INVALID_INPUT", "name is required for the API key.")
    ttl = body.get("ttl_days")
    if ttl is not None:
        ttl = int(ttl)
        if not 1 <= ttl <= 3650:
            return api_error("INVALID_INPUT", "ttl_days must be between 1 and 3650.")

    from ...auth.context import current_user_id

    key, raw = APIKey.generate(org_id, name, current_user_id(), ttl_days=ttl)
    db.session.add(key)
    AuditService.commit(organization_id=org_id, action="API_KEY_CREATED",
                        entity_type="APIKey", summary=f"API key '{name}' issued.")
    db.session.commit()
    return api_ok({"api_key": key.to_dict(), "secret": raw}), 201


@apikeys_bp.delete("/<key_id>")
@roles_required(RoleCode.ADMIN.value)
def revoke_key(key_id):
    org_id = require_org()
    key = APIKey.query.filter_by(id=key_id, organization_id=org_id).first()
    if not key:
        return api_error("NOT_FOUND", "API key not found.", status=404)
    db.session.delete(key)
    AuditService.commit(organization_id=org_id, action="API_KEY_REVOKED",
                        entity_type="APIKey", summary=f"API key '{key.name}' revoked.")
    db.session.commit()
    return api_ok({}), 200
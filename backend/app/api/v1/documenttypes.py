"""Document types (Phase 2): org-definable verifiable document categories."""
from flask import Blueprint, request

from ...auth import require_org, roles_required
from ...extensions import db
from ...models.common import RoleCode
from ...models.domain import DocumentType, ReferenceStatus
from ...services.audit import AuditService
from ...utils.response import api_error, api_ok

documenttypes_bp = Blueprint("documenttypes", __name__)
ROLES = (RoleCode.ADMIN.value, RoleCode.OPERATOR.value)


@documenttypes_bp.get("")
@roles_required(*ROLES)
def list_document_types():
    org_id = require_org()
    rows = DocumentType.query.filter_by(
        organization_id=org_id, status=ReferenceStatus.ACTIVE.value
    ).order_by(DocumentType.created_at.desc()).all()
    return api_ok({"document_types": [r.to_dict() for r in rows]}), 200


@documenttypes_bp.post("")
@roles_required(RoleCode.ADMIN.value)
def create_document_type():
    org_id = require_org()
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    code = (data.get("code") or name or "").strip().upper().replace(" ", "_")[:50]
    if not name or not code:
        return api_error("INVALID_INPUT", "name and a code/short name are required.")

    exists = DocumentType.query.filter_by(organization_id=org_id, code=code).first()
    if exists:
        return api_error("EXISTS", f"A document type '{code}' already exists.")

    fields = data.get("fields") or []
    if not isinstance(fields, list):
        return api_error("INVALID_INPUT", "fields must be an array of field names.")

    row = DocumentType(
        organization_id=org_id, name=name, code=code,
        description=(data.get("description") or "").strip() or None,
        fields=fields, status=ReferenceStatus.ACTIVE,
    )
    db.session.add(row)
    AuditService.commit(organization_id=org_id, action="DOCUMENT_TYPE_CREATED",
                        entity_type="DocumentType", summary=f"Created '{name}' ({code}).")
    db.session.commit()
    return api_ok({"document_type": row.to_dict()}), 201


@documenttypes_bp.get("/<doc_type_id>")
@roles_required(*ROLES)
def get_document_type(doc_type_id):
    org_id = require_org()
    row = DocumentType.query.filter_by(id=doc_type_id, organization_id=org_id).first()
    if not row:
        return api_error("NOT_FOUND", "Document type not found.", status=404)
    return api_ok({"document_type": row.to_dict()}), 200
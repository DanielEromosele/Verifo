"""Trusted reference library (Phase 2): upload, extract, fingerprint, list."""
from flask import Blueprint, request

from ...auth import require_org, roles_required
from ...extensions import db
from ...models.common import RoleCode
from ...models.domain import DocumentType, ReferenceDocument, ReferenceStatus
from ...models.organization import Organization
from ...services.audit import AuditService
from ...services.references import next_ref_code, process_reference
from ...services.security import validate_document_upload
from ...services.storage import sign_download_token
from ...utils.response import api_error, api_ok

references_bp = Blueprint("references", __name__)
ROLES = (RoleCode.ADMIN.value, RoleCode.OPERATOR.value)


def _ref_public(row: ReferenceDocument) -> dict:
    data = row.to_dict()
    data["download_token"] = sign_download_token(row.organization_id, row.storage_path)
    return data


@references_bp.get("")
@roles_required(*ROLES)
def list_references():
    org_id = require_org()
    q = ReferenceDocument.query.filter_by(organization_id=org_id)
    search = (request.args.get("q") or "").strip().lower()
    status = request.args.get("status")
    if status and status in {s.value for s in ReferenceStatus}:
        q = q.filter_by(status=status)
    if search:
        like = f"%{search}%"
        q = q.filter(
            db.or_(
                ReferenceDocument.title.ilike(like),
                ReferenceDocument.ref_code.ilike(like),
                ReferenceDocument.filename.ilike(like),
            )
        )
    rows = q.order_by(ReferenceDocument.created_at.desc()).limit(200).all()
    return api_ok({"references": [_ref_public(r) for r in rows]}), 200


@references_bp.post("")
@roles_required(RoleCode.ADMIN.value)
def upload_reference():
    org_id = require_org()
    file = request.files.get("file")
    title = (request.form.get("title") or "").strip()
    document_type_id = request.form.get("document_type_id") or None

    if not file or not file.filename:
        return api_error("UPLOAD_INVALID", "A reference file is required.")
    if not title:
        return api_error("UPLOAD_INVALID", "A title is required for the reference.")

    data = file.read()
    from ...services.security import UploadValidationError

    try:
        from flask import current_app

        validate_document_upload(
            file.filename, data, int(current_app.config["MAX_REFERENCE_SIZE"]))
    except UploadValidationError as exc:
        return api_error("UPLOAD_INVALID", str(exc))

    if document_type_id:
        doc_type = DocumentType.query.filter_by(
            id=document_type_id, organization_id=org_id).first()
        if not doc_type:
            return api_error("NOT_FOUND", "Document type not found.")
        code = doc_type.code
    else:
        code = "REF"

    count = ReferenceDocument.query.filter_by(organization_id=org_id).count()
    ref_code = next_ref_code(code, count)

    payload = process_reference(
        org_id, filename=file.filename, data=data,
        document_type_id=document_type_id, title=title, ref_code=ref_code,
        fields_config=doc_type.fields if document_type_id else None,
    )
    row = ReferenceDocument(**payload)
    db.session.add(row)
    AuditService.commit(organization_id=org_id, action="REFERENCE_CREATED",
                        entity_type="ReferenceDocument", entity_id=row.id,
                        summary=f"Trusted copy '{title}' processed ({ref_code}).",
                        after={"ref_code": ref_code, "fields": len(row.extracted_fields)})
    db.session.commit()
    return api_ok({"reference": _ref_public(row)}), 201


@references_bp.get("/<reference_id>")
@roles_required(*ROLES)
def get_reference(reference_id):
    org_id = require_org()
    row = ReferenceDocument.query.filter_by(id=reference_id, organization_id=org_id).first()
    if not row:
        return api_error("NOT_FOUND", "Reference not found.")
    data = _ref_public(row)
    data["fields"] = row.extracted_fields or []
    data["baseline"] = (row.fingerprint or {}).get("baseline", {})
    return api_ok({"reference": data}), 200


@references_bp.patch("/<reference_id>")
@roles_required(RoleCode.ADMIN.value)
def archive_reference(reference_id):
    org_id = require_org()
    row = ReferenceDocument.query.filter_by(id=reference_id, organization_id=org_id).first()
    if not row:
        return api_error("NOT_FOUND", "Reference not found.")
    status = request.get_json(silent=True) or {}
    if (status.get("status") or "").upper() in {s.value for s in ReferenceStatus}:
        row.status = ReferenceStatus(status["status"].upper())
    AuditService.commit(organization_id=org_id, action="REFERENCE_UPDATED",
                        entity_type="ReferenceDocument", entity_id=row.id,
                        summary=f"Reference status set to {row.status.value}.")
    db.session.commit()
    return api_ok({"reference": _ref_public(row)}), 200
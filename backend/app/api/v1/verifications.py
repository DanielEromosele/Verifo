"""Single verification workflow (Phase 3) + operator decision (Phase 5).

Upload a submitted document → queue for processing → deterministic pipeline
produces score/breakdown/conclusion/issues → operator finalizes a decision
that is audited. A comment is mandatory for REJECTED or when overriding a
high-score verdict.
"""
from flask import Blueprint, request

from ...auth import current_user_id, require_org, roles_required
from ...extensions import db
from ...models.common import RoleCode
from ...models.domain import QueueTask, ReferenceDocument, Verification, VerificationStatus
from ...services.audit import AuditService
from ...services.security import UploadValidationError, validate_document_upload
from ...services.storage import get_storage, sign_download_token
from ...utils.response import api_error, api_ok

verifications_bp = Blueprint("verifications", __name__)
ROLES = (RoleCode.ADMIN.value, RoleCode.OPERATOR.value)


@verifications_bp.get("")
@roles_required(*ROLES)
def list_verifications():
    org_id = require_org()
    status = request.args.get("status")
    q = Verification.query.filter_by(organization_id=org_id)
    if status and status in {s.value for s in VerificationStatus}:
        q = q.filter_by(status=status)
    rows = q.order_by(Verification.created_at.desc()).limit(200).all()
    return api_ok({"verifications": [r.to_dict() for r in rows]}), 200


@verifications_bp.post("")
@roles_required(*ROLES)
def submit_verification():
    org_id = require_org()
    file = request.files.get("file")
    if not file or not file.filename:
        return api_error("UPLOAD_INVALID", "A document file is required.")
    data = file.read()
    try:
        from flask import current_app

        validate_document_upload(
            file.filename, data, int(current_app.config["MAX_UPLOAD_ITEM_SIZE"]))
    except UploadValidationError as exc:
        return api_error("UPLOAD_INVALID", str(exc))

    reference_id = request.form.get("reference_id") or None
    document_type_id = request.form.get("document_type_id") or None

    ref = None
    if reference_id:
        ref = ReferenceDocument.query.filter_by(
            id=reference_id, organization_id=org_id).first()
        if not ref:
            return api_error("NOT_FOUND", "Reference document not found.")
        document_type_id = document_type_id or ref.document_type_id

    storage = get_storage()
    path = storage.save(org_id, "submissions", file.filename, data)
    from ...services.verification.concrete import sha256_hex

    ver = Verification(
        organization_id=org_id,
        reference_id=ref.id if ref else None,
        document_type_id=document_type_id,
        created_by=current_user_id(),
        filename=file.filename,
        storage_path=path,
        checksum=sha256_hex(data),
        status=VerificationStatus.SUBMITTED,
    )
    db.session.add(ver)
    db.session.flush()
    QueueTask.enqueue(
        organization_id=org_id,
        kind="VERIFY_DOCUMENT",
        payload={"verification_id": ver.id},
    )
    AuditService.commit(organization_id=org_id, action="VERIFICATION_SUBMITTED",
                        entity_type="Verification", entity_id=ver.id,
                        summary=f"Submitted '{file.filename}' for verification.",
                        after={"reference_id": reference_id})
    db.session.commit()
    return api_ok({"verification": ver.to_dict()}), 201


@verifications_bp.get("/<verification_id>")
@roles_required(*ROLES)
def get_verification(verification_id):
    org_id = require_org()
    row = Verification.query.filter_by(id=verification_id, organization_id=org_id).first()
    if not row:
        return api_error("NOT_FOUND", "Verification not found.")
    data = row.to_dict(include_private=True)
    data["download_token"] = sign_download_token(org_id, row.storage_path)
    if row.reference_id:
        ref = ReferenceDocument.query.filter_by(id=row.reference_id).first()
        data["reference"] = ref.to_dict() if ref else None
    return api_ok({"verification": data}), 200


@verifications_bp.post("/<verification_id>/decision")
@roles_required(RoleCode.ADMIN.value, RoleCode.OPERATOR.value)
def decide_verification(verification_id):
    org_id = require_org()
    row = Verification.query.filter_by(id=verification_id, organization_id=org_id).first()
    if not row:
        return api_error("NOT_FOUND", "Verification not found.")
    if row.status not in (VerificationStatus.REVIEW, VerificationStatus.VERIFIED):
        return api_error("INVALID_STATE", "Only reviewable results can be decided.")

    body = request.get_json(silent=True) or {}
    decision = (body.get("decision") or "").upper()
    comment = (body.get("comment") or "").strip()
    if decision not in ("VERIFIED", "REJECTED"):
        return api_error("INVALID_INPUT", "decision must be VERIFIED or REJECTED.")

    sensitive = decision == "REJECTED" or (row.score or 0) < 80
    if sensitive and not comment:
        return api_error(
            "INVALID_INPUT",
            "A comment is mandatory for a rejection or for overriding a low-score result.")

    row.decision = decision
    row.decision_comment = comment or None
    row.decided_by = current_user_id()
    from ...models.common import utcnow

    row.decided_at = utcnow()
    row.status = VerificationStatus.VERIFIED if decision == "VERIFIED" else VerificationStatus.REJECTED

    AuditService.commit(organization_id=org_id, action="VERIFICATION_DECIDED",
                        entity_type="Verification", entity_id=row.id,
                        summary=f"Operator decision: {decision}.",
                        after={"decision": decision, "score": row.score, "comment": comment})
    db.session.commit()
    return api_ok({"verification": row.to_dict()}), 200
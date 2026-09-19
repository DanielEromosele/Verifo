"""External verification API (Phase 7): issue-scope access via API keys.

Clients authenticate with `X-Api-Key` instead of a user JWT. The key maps
to an organization; every row created/read is scoped to that org server-side.
Only result + evidence are exposed — never internal AI infra configuration.
"""
from flask import Blueprint, request

from ...extensions import db
from ...models.apikey import APIKey
from ...models.common import StatusCode
from ...models.domain import QueueTask, ReferenceDocument, Verification, VerificationStatus
from ...services.security import UploadValidationError, validate_document_upload
from ...services.storage import get_storage
from ...services.verification.concrete import sha256_hex
from ...utils.response import api_error, api_ok

external_bp = Blueprint("external", __name__)


def _org_from_key():
    auth = request.headers.get("X-Api-Key") or request.headers.get("Authorization", "").replace("Bearer ", "")
    key = APIKey.verify(auth) if auth else None
    if not key:
        return None
    db.session.add(key)
    db.session.commit()
    return key


@external_bp.get("/status")
def status():
    key = _org_from_key()
    return api_ok({"status": "ready", "organization_id": key.organization_id if key else None}), 200


@external_bp.post("/verifications")
def submit():
    key = _org_from_key()
    if not key:
        return api_error("UNAUTHORIZED", "A valid X-Api-Key header is required.", status=401)
    org_id = key.organization_id

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

    ref_code = request.form.get("reference_code")
    ref = None
    if ref_code:
        ref = ReferenceDocument.query.filter_by(
            organization_id=org_id, ref_code=ref_code,
            status=StatusCode.ACTIVE.value).first()
        if not ref:
            return api_error("NOT_FOUND", "reference_code not found in your library.")

    path = get_storage().save(org_id, "api", file.filename, data)
    ver = Verification(
        organization_id=org_id,
        reference_id=ref.id if ref else None,
        document_type_id=ref.document_type_id if ref else None,
        filename=file.filename,
        storage_path=path,
        checksum=sha256_hex(data),
        status=VerificationStatus.SUBMITTED,
    )
    db.session.add(ver)
    db.session.flush()
    QueueTask.enqueue(organization_id=org_id, kind="VERIFY_DOCUMENT",
                      payload={"verification_id": ver.id})
    db.session.commit()
    return api_ok({"verification": ver.to_dict()}), 201


@external_bp.get("/verifications")
def list_own():
    key = _org_from_key()
    if not key:
        return api_error("UNAUTHORIZED", "A valid X-Api-Key header is required.", status=401)
    org_id = key.organization_id
    rows = Verification.query.filter_by(organization_id=org_id).order_by(
        Verification.created_at.desc()).limit(100).all()
    return api_ok({"verifications": [r.to_dict(include_private=True) for r in rows]}), 200


@external_bp.get("/verifications/<verification_id>")
def get_own(verification_id):
    key = _org_from_key()
    if not key:
        return api_error("UNAUTHORIZED", "A valid X-Api-Key header is required.", status=401)
    row = Verification.query.filter_by(
        id=verification_id, organization_id=key.organization_id).first()
    if not row:
        return api_error("NOT_FOUND", "Verification not found.")
    return api_ok({"verification": row.to_dict(include_private=True)}), 200
"""Bulk screening jobs (Phase 4): ZIP upload → items → background queue."""
import io

from flask import Blueprint, request

from ...auth import current_user_id, require_org, roles_required
from ...extensions import db
from ...models.common import RoleCode
from ...models.domain import (
    ItemStatus,
    JobStatus,
    QueueTask,
    ReferenceDocument,
    ScreeningItem,
    ScreeningJob,
)
from ...services.audit import AuditService
from ...services.security import (
    UploadValidationError,
    check_zip_safety,
    extension_of,
    sniff_kind,
)
from ...services.storage import get_storage
from ...utils.response import api_error, api_ok

jobs_bp = Blueprint("jobs", __name__)
ROLES = (RoleCode.ADMIN.value, RoleCode.OPERATOR.value)


@jobs_bp.get("")
@roles_required(*ROLES)
def list_jobs():
    org_id = require_org()
    rows = ScreeningJob.query.filter_by(organization_id=org_id).order_by(
        ScreeningJob.created_at.desc()).limit(100).all()
    return api_ok({"jobs": [r.to_dict() for r in rows]}), 200


@jobs_bp.post("")
@roles_required(*ROLES)
def create_job():
    org_id = require_org()
    reference_id = request.form.get("reference_id") or None
    title = (request.form.get("title") or "").strip()
    ref = None
    if reference_id:
        ref = ReferenceDocument.query.filter_by(
            id=reference_id, organization_id=org_id).first()
        if not ref:
            return api_error("NOT_FOUND", "Reference document not found.", status=404)

    storage = get_storage()
    files = request.files.getlist("files")
    zip_file = request.files.get("file")
    entries = []

    if files and all(f.filename for f in files):
        for f in files:
            data = f.read()
            ext = extension_of(f.filename)
            if ext not in {"pdf", "png", "jpg", "jpeg"}:
                return api_error("UPLOAD_INVALID", f"Unsupported file type: '{f.filename}'")
            if not sniff_kind(data, ext):
                return api_error("UPLOAD_INVALID", f"Content mismatch: '{f.filename}'")
            path = storage.save(org_id, "bulk", f.filename, data)
            entries.append({"filename": f.filename, "storage_path": path})
    elif zip_file and zip_file.filename:
        zip_bytes = zip_file.read()
        try:
            check_zip_safety(zip_bytes)
        except UploadValidationError as exc:
            return api_error("UPLOAD_INVALID", str(exc))
        import zipfile

        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
            for info in zf.infolist():
                name = info.filename.replace("\\", "/").split("/")[-1]
                if not name or info.is_dir():
                    continue
                ext = extension_of(name)
                if ext not in {"pdf", "png", "jpg", "jpeg"}:
                    continue
                data = zf.read(info)
                if not data or not sniff_kind(data, ext):
                    continue
                path = storage.save(org_id, "bulk", name, data)
                entries.append({"filename": name, "storage_path": path})
    else:
        return api_error("UPLOAD_INVALID", "Provide files[] or a ZIP 'file' upload.")

    if not entries:
        return api_error("UPLOAD_INVALID", "No valid documents found in the upload.")

    job = ScreeningJob(
        organization_id=org_id,
        created_by=current_user_id(),
        title=title or None,
        status=JobStatus.RUNNING,
        total_count=len(entries),
    )
    db.session.add(job)
    db.session.flush()

    for i, e in enumerate(entries):
        item = ScreeningItem(
            job_id=job.id,
            organization_id=org_id,
            reference_id=ref.id if ref else None,
            filename=e["filename"],
            storage_path=e["storage_path"],
            status=ItemStatus.PENDING,
        )
        db.session.add(item)
        db.session.flush()
        QueueTask.enqueue(
            organization_id=org_id,
            kind="VERIFY_BULK_ITEM",
            payload={"item_id": item.id},
        )

    AuditService.commit(organization_id=org_id, action="SCREENING_JOB_CREATED",
                        entity_type="ScreeningJob", entity_id=job.id,
                        summary=f"Bulk job with {len(entries)} document(s) queued.")
    db.session.commit()
    return api_ok({"job": job.to_dict()}), 201


@jobs_bp.get("/<job_id>")
@roles_required(*ROLES)
def get_job(job_id):
    org_id = require_org()
    job = ScreeningJob.query.filter_by(id=job_id, organization_id=org_id).first()
    if not job:
        return api_error("NOT_FOUND", "Screening job not found.", status=404)
    return api_ok({"job": job.to_dict()}), 200


@jobs_bp.get("/<job_id>/items")
@roles_required(*ROLES)
def list_job_items(job_id):
    org_id = require_org()
    job = ScreeningJob.query.filter_by(id=job_id, organization_id=org_id).first()
    if not job:
        return api_error("NOT_FOUND", "Screening job not found.", status=404)
    status = request.args.get("status")
    q = ScreeningItem.query.filter_by(job_id=job_id)
    if status and status in {s.value for s in ItemStatus}:
        q = q.filter_by(status=status)
    rows = q.order_by(ScreeningItem.created_at.asc()).limit(500).all()
    return api_ok({"items": [r.to_dict() for r in rows]}), 200


@jobs_bp.post("/<job_id>/retry")
@roles_required(RoleCode.ADMIN.value)
def retry_failed_items(job_id):
    org_id = require_org()
    job = ScreeningJob.query.filter_by(id=job_id, organization_id=org_id).first()
    if not job:
        return api_error("NOT_FOUND", "Screening job not found.", status=404)
    failed = ScreeningItem.query.filter_by(
        job_id=job_id, organization_id=org_id, status=ItemStatus.FAILED).all()
    for item in failed:
        item.status = ItemStatus.PENDING
        item.error = None
        QueueTask.enqueue(organization_id=org_id, kind="VERIFY_BULK_ITEM",
                          payload={"item_id": item.id})
    AuditService.commit(organization_id=org_id, action="SCREENING_JOB_RETRIED",
                        entity_type="ScreeningJob", entity_id=job.id,
                        summary=f"Requeued {len(failed)} failed item(s).")
    db.session.commit()
    return api_ok({"retried": len(failed)}), 200
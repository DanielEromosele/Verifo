"""Domain models for the verification platform (Phases 2-4).

Reference library: DocumentType, ReferenceDocument.
Single verification: Verification.
Bulk screening: ScreeningJob, ScreeningItem + self-built queue task table.

All org-scoped tables FK to organizations.id and every query path is
tenant-scoped server-side (see repositories).
"""
import enum

from ..extensions import db
from .common import PkUuidMixin, TimestampsMixin, model_enum, utcnow, uuid_str


class ReferenceStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    ARCHIVED = "ARCHIVED"


class VerificationStatus(str, enum.Enum):
    SUBMITTED = "SUBMITTED"
    PROCESSING = "PROCESSING"
    REVIEW = "REVIEW"
    VERIFIED = "VERIFIED"
    REJECTED = "REJECTED"


class JobStatus(str, enum.Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    PARTIAL = "PARTIAL"


class ItemStatus(str, enum.Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    REVIEW = "REVIEW"
    VERIFIED = "VERIFIED"
    FAILED = "FAILED"


class QueueState(str, enum.Enum):
    PENDING = "PENDING"
    CLAIMED = "CLAIMED"
    RETRYING = "RETRYING"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"


class DocumentType(db.Model, PkUuidMixin, TimestampsMixin):
    """A verifiable document category an org defines, e.g. Transcript - 2026."""

    __tablename__ = "document_types"
    __table_args__ = (
        db.UniqueConstraint("organization_id", "code", name="uq_document_type_org_code"),
    )

    organization_id = db.Column(db.String(36), nullable=False, index=True)
    name = db.Column(db.String(200), nullable=False)
    code = db.Column(db.String(50), nullable=False)
    description = db.Column(db.Text, nullable=True)
    fields = db.Column(db.JSON, default=list, nullable=False)  # expected field names
    status = db.Column(model_enum(ReferenceStatus), default=ReferenceStatus.ACTIVE, nullable=False)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "code": self.code,
            "description": self.description,
            "fields": self.fields or [],
            "status": self.status.value if self.status else None,
        }


class ReferenceDocument(db.Model, PkUuidMixin, TimestampsMixin):
    """A trusted/verified original uploaded by the org to serve as a benchmark."""

    __tablename__ = "reference_documents"

    organization_id = db.Column(db.String(36), nullable=False, index=True)
    document_type_id = db.Column(db.String(36), nullable=True, index=True)
    title = db.Column(db.String(300), nullable=False)
    ref_code = db.Column(db.String(40), nullable=False, index=True)  # human code e.g. REF-2026-0001
    filename = db.Column(db.String(255), nullable=False)
    storage_path = db.Column(db.String(400), nullable=False)
    checksum = db.Column(db.String(64), nullable=False)
    fingerprint = db.Column(db.JSON, nullable=False, default=dict)  # text+structure fingerprint
    extracted_fields = db.Column(db.JSON, nullable=False, default=list)
    status = db.Column(model_enum(ReferenceStatus), default=ReferenceStatus.ACTIVE, nullable=False)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "document_type_id": self.document_type_id,
            "title": self.title,
            "ref_code": self.ref_code,
            "filename": self.filename,
            "checksum": self.checksum,
            "fields": self.extracted_fields or [],
            "status": self.status.value if self.status else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Verification(db.Model, PkUuidMixin, TimestampsMixin):
    """A single submitted document going through the verification pipeline."""

    __tablename__ = "verifications"

    organization_id = db.Column(db.String(36), nullable=False, index=True)
    reference_id = db.Column(db.String(36), nullable=True, index=True)
    document_type_id = db.Column(db.String(36), nullable=True)
    created_by = db.Column(db.String(36), nullable=True)

    filename = db.Column(db.String(255), nullable=False)
    storage_path = db.Column(db.String(400), nullable=False)
    checksum = db.Column(db.String(64), nullable=True)

    status = db.Column(model_enum(VerificationStatus), default=VerificationStatus.SUBMITTED, nullable=False)
    score = db.Column(db.Float, nullable=True)          # 0..100 composite
    breakdown = db.Column(db.JSON, nullable=True)       # per-provider sub-scores
    conclusion = db.Column(db.JSON, nullable=True)      # field-level matches
    issues = db.Column(db.JSON, nullable=True)          # findings/red flags
    evidence = db.Column(db.JSON, nullable=True)        # provider evidence strings

    decision = db.Column(db.String(20), nullable=True)  # VERIFIED / REJECTED
    decision_comment = db.Column(db.Text, nullable=True)
    decided_by = db.Column(db.String(36), nullable=True)
    decided_at = db.Column(db.DateTime(timezone=True), nullable=True)

    def to_dict(self, *, include_private=False) -> dict:
        data = {
            "id": self.id,
            "reference_id": self.reference_id,
            "document_type_id": self.document_type_id,
            "status": self.status.value if self.status else None,
            "filename": self.filename,
            "score": self.score,
            "breakdown": self.breakdown,
            "conclusion": self.conclusion,
            "issues": self.issues,
            "decision": self.decision,
            "decision_comment": self.decision_comment,
            "decided_at": self.decided_at.isoformat() if self.decided_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        if include_private:
            data["evidence"] = self.evidence
        return data


class ScreeningJob(db.Model, PkUuidMixin, TimestampsMixin):
    __tablename__ = "screening_jobs"

    organization_id = db.Column(db.String(36), nullable=False, index=True)
    created_by = db.Column(db.String(36), nullable=True)
    title = db.Column(db.String(300), nullable=True)
    status = db.Column(model_enum(JobStatus), default=JobStatus.PENDING, nullable=False)
    total_count = db.Column(db.Integer, default=0, nullable=False)
    processed_count = db.Column(db.Integer, default=0, nullable=False)
    verified_count = db.Column(db.Integer, default=0, nullable=False)
    review_count = db.Column(db.Integer, default=0, nullable=False)
    failed_count = db.Column(db.Integer, default=0, nullable=False)
    error = db.Column(db.Text, nullable=True)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "title": self.title,
            "status": self.status.value if self.status else None,
            "total_count": self.total_count,
            "processed_count": self.processed_count,
            "verified_count": self.verified_count,
            "review_count": self.review_count,
            "failed_count": self.failed_count,
            "error": self.error,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class ScreeningItem(db.Model, PkUuidMixin, TimestampsMixin):
    __tablename__ = "screening_items"

    job_id = db.Column(db.String(36), nullable=False, index=True)
    organization_id = db.Column(db.String(36), nullable=False, index=True)
    reference_id = db.Column(db.String(36), nullable=True)
    filename = db.Column(db.String(255), nullable=False)
    storage_path = db.Column(db.String(400), nullable=True)
    status = db.Column(model_enum(ItemStatus), default=ItemStatus.PENDING, nullable=False)
    score = db.Column(db.Float, nullable=True)
    error = db.Column(db.Text, nullable=True)
    snapshot = db.Column(db.JSON, default=dict, nullable=True)  # conclusion + issues
    decision = db.Column(db.String(20), nullable=True)
    decision_comment = db.Column(db.Text, nullable=True)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "job_id": self.job_id,
            "reference_id": self.reference_id,
            "filename": self.filename,
            "status": self.status.value if self.status else None,
            "score": self.score,
            "error": self.error,
            "snapshot": self.snapshot,
            "decision": self.decision,
            "decision_comment": self.decision_comment,
        }


class QueueTask(db.Model, PkUuidMixin, TimestampsMixin):
    """Self-built background queue (no Redis/Celery): pg/sqlite rows + worker."""

    __tablename__ = "queue_tasks"

    organization_id = db.Column(db.String(36), nullable=False, index=True)
    kind = db.Column(db.String(40), nullable=False, index=True)  # e.g. VERIFY_DOCUMENT
    payload = db.Column(db.JSON, default=dict, nullable=True)
    status = db.Column(model_enum(QueueState), default=QueueState.PENDING, nullable=False, index=True)
    attempts = db.Column(db.Integer, default=0, nullable=False)
    max_attempts = db.Column(db.Integer, default=3, nullable=False)
    error = db.Column(db.Text, nullable=True)
    claimed_until = db.Column(db.DateTime(timezone=True), nullable=True)
    run_after = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=True)

    @classmethod
    def enqueue(cls, *, organization_id: str, kind: str, payload: dict | None = None,
                max_attempts: int = 3, run_after=None) -> "QueueTask":
        task = cls(
            organization_id=organization_id,
            kind=kind,
            payload=payload or {},
            max_attempts=max_attempts,
            run_after=run_after or utcnow(),
        )
        db.session.add(task)
        return task

    @classmethod
    def _aware(cls, dt):
        from datetime import timezone

        if dt is None:
            return None
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt

    @classmethod
    def claim(cls, *, worker: str, lease_seconds: int = 120):
        """Claim the next eligible task ordered FIFO.

        Datetime comparisons happen in Python so the guard behaves the same on
        SQLite (naive round-trip) and Postgres (aware values).
        """
        now = utcnow()
        candidates = cls.query.filter(
            cls.status.in_([QueueState.PENDING, QueueState.RETRYING]),
        ).order_by(cls.created_at.asc(), cls.id.asc()).all()
        for task in candidates:
            claimed_until = cls._aware(task.claimed_until)
            run_after = cls._aware(task.run_after)
            if claimed_until and claimed_until > now:
                continue
            if run_after and run_after > now:
                continue
            from datetime import timedelta

            task.status = QueueState.CLAIMED
            task.claimed_until = now + timedelta(seconds=lease_seconds)
            task.attempts += 1
            return task
        return None

    @classmethod
    def claim_batch(cls, *, worker: str, limit: int, lease_seconds: int = 120):
        tasks = []
        for _ in range(limit):
            task = cls.claim(worker=worker, lease_seconds=lease_seconds)
            if not task:
                break
            tasks.append(task)
        return tasks
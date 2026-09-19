"""Background task contracts.

Phase 4 introduces the self-built SQLAlchemy-backed job queue and worker
threads. This package currently defines the task vocabulary so models and
api/v1 routes can reference it without a runtime dependency. Nothing here
executes work in Phase 1.
"""
import enum


class TaskType(enum.Enum):
    VERIFY_DOCUMENT = "verify_document"
    PURGE_EXPIRED = "purge_expired"
    AUDIT_COMPACTION = "audit_compaction"


class TaskState(enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    RETRYING = "retrying"


__all__ = ["TaskState", "TaskType"]
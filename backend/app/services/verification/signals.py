"""Domain signals produced by verification analyzers.

These plain dataclasses are the contract between individual analyzers,
the scoring pipeline, and the operator-facing UI. They carry evidence,
never final verdicts.
"""
from dataclasses import dataclass, field
from typing import Literal


@dataclass
class ExtractedField:
    """A field pulled from a document (OCR/structural extraction)."""

    key: str                     # e.g. "student_name", "matric_number"
    value: str
    confidence: float            # 0..1
    source: str                  # "ocr", "pdf_meta", "barcode", "database"
    raw: str | None = None


@dataclass
class FieldMatch:
    """Comparison between an extracted field and a reference value."""

    key: str
    reference: str
    extracted: str
    status: Literal["match", "mismatch", "partial", "missing"]
    confidence: float = 1.0


@dataclass
class Finding:
    """A non-blocking note about a document's content or structure."""

    code: str                    # machine key, e.g. "TRACELESS_ISSUER"
    level: Literal["info", "warning", "review"]
    message: str
    details: dict = field(default_factory=dict)


@dataclass
class ScoreBreakdown:
    """Weighted sub-scores per analyzer area."""

    ocr: float = 0.0
    database: float = 0.0
    reference: float = 0.0
    integrity: float = 0.0
    total: float = 0.0
    weights: dict = field(default_factory=dict)
    findings: list[Finding] = field(default_factory=list)


@dataclass
class VerificationReport:
    """Result of a full verification run (all analyzers + scoring)."""

    document_id: str
    breakdown: ScoreBreakdown
    verdict: Literal["verified", "review", "failed"]
    evidence: list[str] = field(default_factory=list)
    proposed_status: str | None = None  # maps to StatusCode once persisted
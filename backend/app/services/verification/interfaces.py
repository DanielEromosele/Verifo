"""Analyzer interfaces for the verification pipeline.

Implementation strategy (Phase 2): each analyzer independently contributes
a score and evidence. Nothing here trusts an external provider; the final
decision is computed deterministically by ScoreCalculator from configurable
weights and thresholds. Analyzers return signals — never verdicts.
"""
import abc

from .signals import ExtractedField, FieldMatch, Finding, ScoreBreakdown


class OCRAnalyzer(abc.ABC):
    """Extracts machine-readable fields from a document image/list."""

    @abc.abstractmethod
    def extract(self, asset_path: str) -> list[ExtractedField]:
        """Return fields with per-field confidence. Must not raise on bad input."""


class ReferenceComparator(abc.ABC):
    """Compares extracted fields against a list of reference records."""

    def compare(self, extracted: list[ExtractedField], references: list[dict]) -> list[FieldMatch]:
        """Match extracted fields against reference docs (field-name aware)."""


class DatabaseVerifier(abc.ABC):
    """Checks a document against the issuing institution's own records."""

    def verify(self, fields: list[ExtractedField], organization_id: str) -> ScoreBreakdown:
        """Query authoritative records; quota-aware; never returns a verdict."""


class IntegrityAnalyzer(abc.ABC):
    """Checks pixel/structure integrity: tampering, watermarks, metadata."""

    def analyze(self, asset_paths: list[str]) -> ScoreBreakdown:
        """Run ELA/META/structural heuristics; produce a score + findings."""


class VerificationEngine(abc.ABC):
    """Top-level pipeline that orchestrates every analyzer for one document."""

    def __init__(
        self,
        ocr: OCRAnalyzer,
        comparator: ReferenceComparator,
        database: DatabaseVerifier,
        integrity: IntegrityAnalyzer,
        scorer,
    ):  # pragma: no cover - interface only
        self.ocr = ocr
        self.comparator = comparator
        self.database = database
        self.integrity = integrity
        self.scorer = scorer

    @abc.abstractmethod
    def run(
        self,
        document_assets: list[str],
        claimed_references: list[dict],
        organization_id: str,
        config: dict,
    ):
        """Return a VerificationReport. Concrete in Phase 2."""
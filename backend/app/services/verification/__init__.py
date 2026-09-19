"""Verification subsystem: signals, analyzers, scoring, engine.

Concrete in-house analyzers live in :mod:`concrete`; everything is
transport- and provider-agnostic and never claims an external AI model.
"""
from .concrete import (
    DemoVerificationEngine,
    IntegrityAnalyzerImpl,
    ReferenceComparatorImpl,
    ReferenceDatabaseVerifier,
    TextLayerOCR,
)
from .interfaces import (
    DatabaseVerifier,
    IntegrityAnalyzer,
    OCRAnalyzer,
    ReferenceComparator,
    VerificationEngine,
)
from .scoring import ScoreCalculator
from .signals import (
    ExtractedField,
    FieldMatch,
    Finding,
    ScoreBreakdown,
    VerificationReport,
)


def build_engine(config: dict | None = None, *, provider=None) -> VerificationEngine:
    """Default deterministic engine: in-house OCR + reference + library + integrity.

    An optional AI ``provider`` (from :mod:`app.services.ai`) supplements
    extraction when available; it never replaces the local analyzers.
    """
    if config is None:
        from ...config.base import BaseConfig

        config = BaseConfig.default_verification_config()
    return DemoVerificationEngine(
        ocr=TextLayerOCR(),
        comparator=ReferenceComparatorImpl(),
        database=ReferenceDatabaseVerifier(),
        integrity=IntegrityAnalyzerImpl(),
        scorer=ScoreCalculator(config),
        provider=provider,
    )


__all__ = [
    "DatabaseVerifier",
    "DemoVerificationEngine",
    "ExtractedField",
    "FieldMatch",
    "Finding",
    "IntegrityAnalyzer",
    "IntegrityAnalyzerImpl",
    "OCRAnalyzer",
    "ReferenceComparator",
    "ReferenceComparatorImpl",
    "ReferenceDatabaseVerifier",
    "ScoreBreakdown",
    "ScoreCalculator",
    "TextLayerOCR",
    "VerificationEngine",
    "VerificationReport",
    "build_engine",
]
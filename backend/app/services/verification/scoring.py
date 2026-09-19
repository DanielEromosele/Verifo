"""Deterministic score calculation: weights + thresholds (config-driven).

The scorer never fabricates findings and never overrides evidence. It is the
single place where the numeric verdict (verified / review / failed) is
derived from analyzer sub-scores. Defaults come from
BaseConfig.default_verification_config() and may be overridden per org and
per run (Phase 2).
"""
from .signals import Finding, ScoreBreakdown, VerificationReport


class ScoreCalculator:
    def __init__(self, config: dict | None = None):
        self.config = config or {}

    def score(self, parts: dict, findings: list[Finding]) -> ScoreBreakdown:
        weights = self.config.get("weights", {}) or {}
        known = {
            "ocr": parts.get("ocr", 0.0),
            "database": parts.get("database", 0.0),
            "reference": parts.get("reference", 0.0),
            "integrity": parts.get("integrity", 0.0),
        }
        total = sum(known[k] * weights.get(k, 0.0) for k in known)
        return ScoreBreakdown(
            ocr=known["ocr"],
            database=known["database"],
            reference=known["reference"],
            integrity=known["integrity"],
            total=round(total, 1),
            weights=weights,
            findings=findings,
        )

    def classify(self, breakdown: ScoreBreakdown) -> str:
        thresholds = self.config.get("thresholds", {})
        verified = float(thresholds.get("verified_min", 80))
        review = float(thresholds.get("review_min", 50))
        if breakdown.total >= verified:
            return "verified"
        if breakdown.total >= review:
            return "review"
        return "failed"
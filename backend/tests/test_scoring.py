"""Scoring engine unit tests (weights + thresholds, config-driven)."""
from app.services.verification import (
    Finding,
    ScoreCalculator,
    ScoreBreakdown,
)


def test_weights_and_total():
    cfg = {
        "weights": {"ocr": 0.25, "database": 0.25, "reference": 0.30, "integrity": 0.20},
        "thresholds": {"verified_min": 80, "review_min": 50},
    }
    calc = ScoreCalculator(cfg)
    bd = calc.score(
        {"ocr": 80, "database": 90, "reference": 100, "integrity": 70},
        [Finding(code="X", level="info", message="ok")],
    )
    assert bd.ocr == 80
    expected = round(0.25 * 80 + 0.25 * 90 + 0.30 * 100 + 0.20 * 70, 1)
    assert bd.total == expected
    assert len(bd.findings) == 1


def test_classification_boundaries():
    cfg = {
        "weights": {"ocr": 1.0, "database": 0, "reference": 0, "integrity": 0},
        "thresholds": {"verified_min": 80, "review_min": 50},
    }
    calc = ScoreCalculator(cfg)
    assert calc.classify(ScoreBreakdown(ocr=90, total=90)) == "verified"
    assert calc.classify(ScoreBreakdown(ocr=80, total=80)) == "verified"
    assert calc.classify(ScoreBreakdown(ocr=65, total=65)) == "review"
    assert calc.classify(ScoreBreakdown(ocr=49, total=49)) == "failed"


def test_default_config_matches_base():
    from app.config import BaseConfig

    cfg = BaseConfig.default_verification_config()
    assert sum(cfg["weights"].values()) == 1.0
    assert set(cfg["weights"]) == {"ocr", "database", "reference", "integrity"}
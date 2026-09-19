"""AI provider resolution (fallback chain) + engine supplementation tests."""
import io  # noqa: F401  (kept scratch import for parity)

from app.services.ai import get_provider, resolve_from_config
from app.services.ai.base import AnalysisResult
from app.services.demo import (
    TRANSCRIPT_GENUINE,
    render_transcript_pdf,
)
from app.services.verification import ExtractedField, build_engine


def _config(**overrides):
    cfg = {
        "AI_PROVIDER": "auto",
        "AI_MODEL": "",
        "GEMINI_API_KEY": "",
        "GROQ_API_KEY": "",
    }
    cfg.update(overrides)
    return cfg


def test_no_credentials_resolves_to_local():
    from app.services.verification.concrete import TextLayerOCR

    provider = resolve_from_config(_config(), ocr=TextLayerOCR())
    assert provider.meta.name == "local"
    assert provider.available()


def test_gemini_key_preferred_over_groq():
    provider = resolve_from_config(_config(GEMINI_API_KEY="gk", GROQ_API_KEY="rk"))
    assert provider.meta.name == "gemini"
    assert provider.available()


def test_groq_key_used_when_no_gemini_key():
    provider = resolve_from_config(_config(GROQ_API_KEY="gk"))
    assert provider.meta.name == "groq"
    assert provider.available()


def test_pinned_groq_without_key_falls_back_to_local():
    from app.services.verification.concrete import TextLayerOCR

    provider = resolve_from_config(_config(AI_PROVIDER="groq"), ocr=TextLayerOCR())
    assert provider.meta.name == "local"
    assert provider.available()


def test_pinned_puter_is_rejected_as_unknown():
    from app.services.ai.base import AIProviderError

    try:
        resolve_from_config(_config(AI_PROVIDER="puter"))
    except AIProviderError as exc:
        assert "Unknown AI provider" in str(exc)
    else:
        raise AssertionError("puter should no longer exist as a provider")


def test_unknown_provider_raises():
    from app.services.ai.base import AIProviderError

    try:
        get_provider("not-a-provider")
    except AIProviderError as exc:
        assert "Unknown AI provider" in str(exc)
    else:
        raise AssertionError("unknown provider should raise")


def _fake_provider(fields=None):
    class FakeProvider:
        meta = type("M", (), {"name": "fake", "model": "fake-v1"})()

        def available(self):
            return True

        def analyze(self, asset_paths, context=None):
            return AnalysisResult(
                provider="fake", model="fake-v1", fields=fields or [],
                source="fake")

    return FakeProvider()


def test_engine_merges_ai_fields_into_extraction_and_records_evidence(tmp_path):
    import fitz  # noqa: F401
    from app.services.verification.concrete import (
        DemoVerificationEngine,
        TextLayerOCR,
    )

    pdf = render_transcript_pdf(TRANSCRIPT_GENUINE)
    asset = tmp_path / "doc.pdf"
    asset.write_bytes(pdf)

    # Local text-layer extraction of the genuine transcript
    local_fields = TextLayerOCR().extract(str(asset))

    # AI returns a field the local engine cannot see.
    ai_field = ExtractedField(
        key="issue_date", value="12 Jan 2020", confidence=0.9, source="gemini")
    engine = build_engine(provider=_fake_provider(fields=[ai_field]))
    report = engine.run([str(asset)], [], "org-1")

    assert any("AI provider 'fake/fake-v1'" in e for e in report.evidence)
    assert local_fields  # local text extraction did capture content

    # The merge helper must fold the AI field in when confidence is higher.
    merged = DemoVerificationEngine._merge_fields(local_fields, [ai_field])
    by_key = {f.key: f for f in merged}
    assert by_key["issue_date"].value == "12 Jan 2020"
    assert by_key["issue_date"].confidence == 0.9


def test_engine_merges_supplemental_browser_fields_and_records_evidence(tmp_path):
    """Browser-side Transformers.js `ai_evidence` augments the extraction."""
    import fitz  # noqa: F401
    from app.services.verification.concrete import (
        DemoVerificationEngine,
        TextLayerOCR,
    )

    pdf = render_transcript_pdf(TRANSCRIPT_GENUINE)
    asset = tmp_path / "doc.pdf"
    asset.write_bytes(pdf)

    local_fields = TextLayerOCR().extract(str(asset))
    browser = ExtractedField(
        key="institution", value="Federal University of Technology", confidence=0.7,
        source="browser-nlp")

    engine = build_engine(provider=None)
    report = engine.run(
        [str(asset)], [], "org-1",
        supplemental_fields=[browser])

    assert any("Transformers.js" in e for e in report.evidence)
    merged = DemoVerificationEngine._merge_fields(local_fields, [browser])
    by_key = {f.key: f for f in merged}
    assert by_key["institution"] is not None
    assert by_key["institution"].source == "browser-nlp"


def test_engine_survives_failing_provider(tmp_path):
    class BrokenProvider:
        meta = type("M", (), {"name": "broken", "model": "b1"})()
        source = "broken"

        def available(self):
            return True

        def analyze(self, asset_paths, context=None):
            raise RuntimeError("boom")

    asset = tmp_path / "doc.pdf"
    asset.write_bytes(render_transcript_pdf(TRANSCRIPT_GENUINE))
    engine = build_engine(provider=BrokenProvider())
    report = engine.run([str(asset)], [], "org-1")
    assert report.verdict in ("verified", "review", "failed")
    assert any("AI provider unavailable" in e for e in report.evidence)
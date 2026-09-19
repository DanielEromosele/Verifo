"""Local provider: deterministic in-house extraction (text layer + structure).

This is the MVP default. It does not use an LLM; it delegates extraction to
the OCRAnalyzer implementation provided by the verification subsystem, so
all signals stay inside Verifo's own pipeline. It is NOT a model and makes
no claims beyond what the analyzers produce.
"""
from ..verification import OCRAnalyzer
from .base import AIProvider, AIProviderError, AnalysisResult, ProviderMeta


class LocalProvider(AIProvider):
    meta = ProviderMeta(
        name="local",
        kind="local",
        model="verifo-ocr-v1",
        requires_key=False,
        caveat="Deterministic in-house text-layer + structure analysis. No external model in use.",
    )

    def __init__(self, ocr: OCRAnalyzer | None = None):
        self._ocr = ocr

    def available(self) -> bool:
        return self._ocr is not None

    def analyze(self, asset_paths: list[str], context: dict | None = None) -> AnalysisResult:
        if not self.available():
            raise AIProviderError(
                "Local provider requires an OCRAnalyzer; none is bound."
            )
        fields: list = []
        for path in asset_paths:
            try:
                fields.extend(self._ocr.extract(path))
            except Exception as exc:  # noqa: BLE001 - provider isolates failures
                raise AIProviderError(f"Local extraction failed for '{path}': {exc}")
        return AnalysisResult(
            provider="local",
            model=self.meta.model,
            fields=fields,
            source="ocr",
        )
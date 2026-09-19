"""Groq provider — reserved configuration slot (Phase 5)."""
from .base import AIProvider, AIProviderError, AnalysisResult, ProviderMeta


class GroqProvider(AIProvider):
    meta = ProviderMeta(
        name="groq",
        kind="llm",
        model="",
        requires_key=True,
        caveat="AI-assisted analysis is a supplement, never sole evidence. Requires key.",
    )

    def __init__(self, api_key: str = "", model: str = ""):
        self._key = api_key
        self.meta = ProviderMeta(
            **{**self.meta.__dict__, "model": model or "llama-3.3-70b-versatile"}
        )

    def available(self) -> bool:
        return bool(self._key)

    def analyze(self, asset_paths: list[str], context: dict | None = None) -> AnalysisResult:
        raise NotImplementedError(
            "Groq provider is a reserved slot and is not wired in Phase 1."
        )
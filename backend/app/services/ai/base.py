"""AI provider abstraction.

The system supports pluggable analysis providers. The MVP default is the
deterministic LocalProvider (in-house OCR/structural extraction). Gemini and
Groq are reserved, configurable slots; their stubs raise NotImplementedError
until real integration lands (Phase 5). No provider ever produces a verdict
on its own — output always flows back through Verifo's scoring engine, and
the source (provider + model) is recorded as evidence.
"""
import abc
from dataclasses import dataclass, field
from typing import Literal


class AIProviderError(RuntimeError):
    """Raised when a provider cannot produce evidence (never a verdict)."""


@dataclass
class ProviderMeta:
    name: str
    kind: Literal["local", "llm"]
    model: str | None = None
    requires_key: bool = False
    #: Human-comprehensible caveat surfaced to operators when enabled.
    caveat: str = ""


@dataclass
class AnalysisResult:
    """Provider output. Always evidence-shaped; never a final verdict."""

    provider: str
    model: str
    fields: list = field(default_factory=list)
    findings: list = field(default_factory=list)
    source: str = "provider"


class AIProvider(abc.ABC):
    meta: ProviderMeta

    @abc.abstractmethod
    def available(self) -> bool:
        """Whether this provider is configured and can serve requests."""

    @abc.abstractmethod
    def analyze(self, asset_paths: list[str], context: dict | None = None) -> AnalysisResult:
        """Produce evidence from assets. Must raise AIProviderError on failure."""
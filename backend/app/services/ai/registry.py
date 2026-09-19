"""Provider registry: choose a provider from configuration.

Resolution order (greedy fallback down the chain):
  1. The provider named in AI_PROVIDER, when it is explicitly set and
     configured (e.g. AI_PROVIDER=gemini with a GEMINI_API_KEY).
  2. Any configured API-key provider (Gemini, then Groq).
  3. Local — deterministic in-house text-layer engine (always available).

Browser-side Transformers.js enrichment is not in this chain: it rides along
with the upload as `ai_evidence` and is merged by the engine at processing
time (see verification.concrete.demo_engine.supplemental_fields).

"local" is the base pipeline in every case; an LLM provider only supplements
it. Nothing here ever produces a verdict on its own.
"""
from .base import AIProvider, AIProviderError
from .gemini import GeminiProvider
from .groq import GroqProvider
from .local import LocalProvider

_REGISTRY = {
    "local": LocalProvider,
    "gemini": GeminiProvider,
    "groq": GroqProvider,
}


def get_provider(
    name: str,
    *,
    api_key: str = "",
    model: str = "",
    ocr=None,
) -> AIProvider:
    cls = _REGISTRY.get((name or "local").strip().lower())
    if cls is None:
        raise AIProviderError(f"Unknown AI provider '{name}'.")
    if cls is LocalProvider:
        return cls(ocr=ocr)
    return cls(api_key=api_key, model=model)


def resolve_from_config(config: dict, ocr=None) -> AIProvider:
    """Return a usable provider, preferring keys and falling back to local."""
    named = (config.get("AI_PROVIDER") or "local").strip().lower()
    model = config.get("AI_MODEL", "")
    gemini_key = (config.get("GEMINI_API_KEY") or "").strip()
    groq_key = (config.get("GROQ_API_KEY") or "").strip()

    ordered = [named] if named not in ("local", "auto") else []
    if gemini_key:
        ordered.append("gemini")
    if groq_key:
        ordered.append("groq")
    ordered.append("local")

    for candidate in ordered:
        provider = get_provider(
            candidate,
            api_key=gemini_key or groq_key,
            model=model,
            ocr=ocr,
        )
        if provider.available():
            return provider
    return LocalProvider(ocr=ocr)
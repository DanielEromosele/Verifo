"""Provider registry: choose a provider from configuration."""
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
    return get_provider(
        config.get("AI_PROVIDER", "local"),
        api_key=config.get("GEMINI_API_KEY") or config.get("GROQ_API_KEY") or "",
        model=config.get("AI_MODEL", ""),
        ocr=ocr,
    )
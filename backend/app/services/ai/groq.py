"""Groq provider — real integration via the REST API (stdlib urllib, no SDK)."""
import json
import urllib.error
import urllib.request

from .base import AIProvider, AIProviderError, AnalysisResult, ProviderMeta

_GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions"


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

    def _extract_text_from_assets(self, asset_paths: list[str]) -> str:
        import fitz

        texts = []
        for path in asset_paths:
            try:
                with fitz.open(path) as doc:
                    for page in doc:
                        t = page.get_text("text") or ""
                        if t:
                            texts.append(t)
            except Exception:
                continue
        return "\n\n".join(texts)[:12000]

    def analyze(self, asset_paths: list[str], context: dict | None = None) -> AnalysisResult:
        if not self.available():
            raise AIProviderError("Groq provider requires an API key.")

        text = self._extract_text_from_assets(asset_paths)
        if not text.strip():
            return AnalysisResult(
                provider="groq",
                model=self.meta.model,
                fields=[],
                findings=["No extractable text found in document assets."],
                source="provider",
            )

        prompt = self._build_prompt(text, context)
        payload = json.dumps({
            "model": self.meta.model,
            "messages": [
                {"role": "system", "content": "You are a document analysis assistant. Return only valid JSON."},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.1,
            "max_tokens": 2048,
        }).encode("utf-8")

        try:
            req = urllib.request.Request(
                _GROQ_ENDPOINT, data=payload,
                headers={"Content-Type": "application/json",
                         "Authorization": f"Bearer {self._key}"},
                method="POST")
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")[:500]
            raise AIProviderError(f"Groq API error {exc.code}: {detail}") from exc
        except Exception as exc:
            raise AIProviderError(f"Groq API call failed: {exc}") from exc

        try:
            content = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise AIProviderError(f"Unexpected Groq response shape: {exc}") from exc

        fields, findings = self._parse_response(content)
        return AnalysisResult(
            provider="groq",
            model=self.meta.model,
            fields=fields,
            findings=findings,
            source="provider",
        )

    def _build_prompt(self, text: str, context: dict | None) -> str:
        doc_type = (context or {}).get("doc_type", "academic document")
        return f"""You are a document analysis assistant for Verifo. Extract structured fields from the following {doc_type} text.

Return a JSON object with:
- "fields": list of objects with "key", "value", "confidence" (0.0-1.0)
- "findings": list of strings (observations, warnings, or notes)

Focus on these key fields if present:
- student_name / full_name
- matric_number / registration_number
- date_of_birth / dob
- programme / program_of_study
- degree
- cgpa
- session / academic_session
- year_of_admission
- level
- institution / university
- student_id

Only include fields you can confidently extract. Use the exact key names above.
Confidence should reflect how certain you are (0.0-1.0).

Document text:
{text}

Return ONLY valid JSON. No markdown, no explanation.
"""

    def _parse_response(self, content: str):
        from ..verification.signals import ExtractedField

        fields = []
        findings = []
        try:
            data = json.loads(content)
            for item in data.get("fields", []):
                key = str(item.get("key", "")).strip()
                value = str(item.get("value", "")).strip()
                conf = float(item.get("confidence", 0.7))
                if key and value:
                    fields.append(ExtractedField(
                        key=key, value=value,
                        confidence=max(0.0, min(1.0, conf)), source="groq"))
            findings = [str(f) for f in data.get("findings", []) if str(f).strip()]
        except Exception:
            findings.append("Failed to parse Groq response as JSON.")
        return fields, findings
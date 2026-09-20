"""Concrete in-house analyzers (Phase 2/3).

Deterministic, local, explainable. No cloud OCR, no external provider;
everything is derived from the document itself (text layer, structure,
metadata) and the org's own reference records. Findings are signals with
evidence — never verdicts.
"""
import difflib
import hashlib
import re
from urllib.parse import unquote

import fitz  # PyMuPDF - in-house text-layer capture

from .interfaces import (
    DatabaseVerifier,
    IntegrityAnalyzer,
    OCRAnalyzer,
    ReferenceComparator,
    VerificationEngine,
)
from .scoring import ScoreCalculator
from .signals import ExtractedField, FieldMatch, Finding, ScoreBreakdown, VerificationReport


def _get_rapid_ocr():
    """Lazy-load RapidOCR; returns None if not available (deploy-time dep)."""
    try:
        from rapidocr_onnxruntime import RapidOCR
        return RapidOCR()
    except Exception:
        return None

_LABEL_KEYS = {
    "name": ("full_name", "student_name"),
    "full name": ("full_name",),
    "student name": ("student_name",),
    "matric": ("matric_number",),
    "matric no": ("matric_number",),
    "matric number": ("matric_number",),
    "reg no": ("matric_number",),
    "ug/matno": ("matric_number",),
    "registration number": ("matric_number",),
    "date of birth": ("dob",),
    "dob": ("dob",),
    "programme": ("programme",),
    "program of study": ("programme",),
    "degree": ("degree",),
    "cgpa": ("cgpa",),
    "session": ("session",),
    "year of admission": ("year_of_admission",),
    "level": ("level",),
    "grade": ("grade",),
    "institution": ("institution",),
    "university": ("institution",),
    "student id": ("student_id",),
}

_VALUE_PATTERNS = {
    "matric_number": re.compile(r"\b\d{2}[/]?\d{1,2}/(?:UG|PG)[/\s-]*\d{3,5}\b", re.I),
    "cgpa": re.compile(r"\b[0-4](?:\.\d{1,3})?\b"),
    "session": re.compile(r"\b20\d{2}/?20\d{2}\b"),
    "year_of_admission": re.compile(r"\b20\d{2}\b"),
}


def normalize(s: str) -> str:
    return re.sub(r"[\s\-_/.,:;']+", "", (s or "").lower())


def sha256_hex(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def _clean_label(label: str) -> str:
    return re.sub(r"[\s:._\-()\[\]/\\]+", " ", label.strip()).strip().lower()


class TextLayerOCR(OCRAnalyzer):
    """Extracts a document's text layer and structured fields (in-house)."""

    def extract(self, asset_path: str) -> list[ExtractedField]:
        fields: list[ExtractedField] = []
        text = ""
        try:
            with fitz.open(asset_path) as doc:
                for page in doc:
                    text += page.get_text("text") or ""
                text = unquote(text) if "%" in text else text
        except Exception:
            return [ExtractedField(key="doc_text", value="", confidence=0.0, source="ocr")]

        full_text = re.sub(r"[ \t]+", " ", text)
        fields.append(ExtractedField(key="doc_text", value=full_text.strip()[:4000],
                                     confidence=1.0, source="ocr", raw=full_text[:500]))
        fields.append(ExtractedField(key="doc_hash", value=sha256_hex(full_text.encode()),
                                     confidence=1.0, source="ocr"))

        structured = self._structured_fields(full_text)
        fields.extend(structured)
        return fields

    @staticmethod
    def _structured_fields(text: str) -> list[ExtractedField]:
        out: list[ExtractedField] = []
        seen: dict[str, str] = {}

        for m in re.finditer(r"([A-Za-z][A-Za-z ./_()\-]{2,40}):\s*(.{2,120})", text):
            label, value = m.group(1), m.group(2).strip()
            label = _clean_label(label)
            for token, keys in _LABEL_KEYS.items():
                if token in label:
                    key = keys[0]
                    if key not in seen:
                        seen[key] = value
                        out.append(ExtractedField(key=key, value=value,
                                                  confidence=0.85, source="ocr"))
                    break

        for key, pat in _VALUE_PATTERNS.items():
            if key in seen:
                continue
            m = pat.search(text)
            if m:
                out.append(ExtractedField(key=key, value=m.group(0).strip(),
                                          confidence=0.6, source="ocr"))
        return out


class HybridOCR(OCRAnalyzer):
    """Hybrid OCR: text-layer first; falls back to scan OCR if text density is low."""

    def __init__(self):
        self._text_layer = TextLayerOCR()
        self._scan = ScanOCRAnalyzer()

    def extract(self, asset_path: str) -> list[ExtractedField]:
        # Try text layer first
        fields = self._text_layer.extract(asset_path)
        doc_text_field = next((f for f in fields if f.key == "doc_text"), None)
        text_len = len(doc_text_field.value) if doc_text_field else 0

        # If text layer has substantial content, use it
        if text_len > 200:
            return fields

        # Low text density -> likely a scan; try scan OCR if available
        if self._scan.available():
            scan_fields = self._scan.extract(asset_path)
            scan_text = next((f for f in scan_fields if f.key == "doc_text"), None)
            if scan_text and len(scan_text.value) > text_len:
                # Annotate that scan OCR was used
                for f in scan_fields:
                    if f.source == "ocr":
                        f.source = "ocr-scan"
                return scan_fields

        # Return text-layer result (may be sparse)
        return fields


class ScanOCRAnalyzer(OCRAnalyzer):
    """OCR for scanned/image-based PDFs using RapidOCR (deploy-time dep).

    Falls back gracefully if RapidOCR is not installed.
    """

    def __init__(self):
        self._engine = _get_rapid_ocr()

    def available(self) -> bool:
        return self._engine is not None

    def extract(self, asset_path: str) -> list[ExtractedField]:
        if not self.available():
            return [ExtractedField(key="doc_text", value="", confidence=0.0,
                                   source="ocr", raw="RapidOCR not installed")]

        import fitz
        from PIL import Image
        import io

        fields: list[ExtractedField] = []
        full_text_parts = []

        try:
            with fitz.open(asset_path) as doc:
                for page_num, page in enumerate(doc):
                    # Render page to image at 300 DPI for good OCR
                    pix = page.get_pixmap(dpi=300)
                    img = Image.open(io.BytesIO(pix.tobytes("png")))

                    # Run OCR
                    result, _ = self._engine(img)
                    if result:
                        page_text = "\n".join([line[1] for line in result])
                        full_text_parts.append(page_text)
        except Exception as exc:
            return [ExtractedField(key="doc_text", value="", confidence=0.0,
                                   source="ocr", raw=f"Scan OCR failed: {exc}")]

        full_text = "\n\n".join(full_text_parts)
        if not full_text.strip():
            return [ExtractedField(key="doc_text", value="", confidence=0.0,
                                   source="ocr", raw="No text recognized from scan")]

        # Same structured extraction as TextLayerOCR
        fields.append(ExtractedField(key="doc_text", value=full_text.strip()[:4000],
                                     confidence=0.8, source="ocr", raw=full_text[:500]))
        fields.append(ExtractedField(key="doc_hash", value=sha256_hex(full_text.encode()),
                                     confidence=1.0, source="ocr"))

        structured = self._structured_fields(full_text)
        fields.extend(structured)
        return fields

    @staticmethod
    def _structured_fields(text: str) -> list[ExtractedField]:
        # Reuse the same logic from TextLayerOCR
        out: list[ExtractedField] = []
        seen: dict[str, str] = {}

        for m in re.finditer(r"([A-Za-z][A-Za-z ./_()\-]{2,40}):\s*(.{2,120})", text):
            label, value = m.group(1), m.group(2).strip()
            label = _clean_label(label)
            for token, keys in _LABEL_KEYS.items():
                if token in label:
                    key = keys[0]
                    if key not in seen:
                        seen[key] = value
                        out.append(ExtractedField(key=key, value=value,
                                                  confidence=0.75, source="ocr"))
                    break

        for key, pat in _VALUE_PATTERNS.items():
            if key in seen:
                continue
            m = pat.search(text)
            if m:
                out.append(ExtractedField(key=key, value=m.group(0).strip(),
                                          confidence=0.55, source="ocr"))
        return out


class ReferenceComparatorImpl(ReferenceComparator):
    """Field-level comparison against a reference document (offset-aware)."""

    def compare(self, extracted, references) -> list[FieldMatch]:
        ref_fields: dict[str, list] = {}
        for ref in references or []:
            for f in ref.get("extracted_fields") or ref.get("fields") or []:
                ref_fields.setdefault(str(f.get("key")), []).append(str(f.get("value", "")))

        matches: list[FieldMatch] = []
        by_key: dict[str, FieldMatch] = {}
        for f in extracted:
            key = str(f.key)
            if key in ("doc_text", "doc_hash"):
                continue
            ref_values = ref_fields.get(key)
            if not ref_values:
                matches.append(FieldMatch(key=key, reference="", extracted=f.value,
                                          status="missing", confidence=f.confidence))
                continue
            reference = ref_values[0]
            a, b = normalize(f.value), normalize(reference)
            sim = difflib.SequenceMatcher(None, a, b).ratio()
            if not a or not b:
                status, sim = "missing", 0.0
            elif sim >= 0.97:
                status = "match"
            elif sim >= 0.6:
                status = "partial"
            else:
                status = "mismatch"
            matches.append(FieldMatch(key=key, reference=reference, extracted=f.value,
                                      status=status, confidence=max(f.confidence, sim)))
            by_key[key] = matches[-1]
        return matches


class ReferenceDatabaseVerifier(DatabaseVerifier):
    """Authoritative lookup against the org's in-library issued records.

    Evidence is honest: we say exactly how many matched records were found.
    A missing pair is a *signal*, never an automatic forgery claim.
    """

    def verify(self, fields, organization_id: str, *, lookup=None) -> ScoreBreakdown:
        findings: list[Finding] = []
        key_fields = {f.key: f.value for f in fields if not f.key.startswith("doc_")}
        records = lookup(key_fields) if lookup else []
        record_count = len(records)

        if record_count == 0:
            score = 0.0
            findings.append(Finding(
                code="NO_LIBRARY_RECORD", level="review",
                message="No in-library issued record matched the submitted details.",
                details={"searched_kind": "institution-library"},))
            return ScoreBreakdown(database=score, findings=findings)

        matched = 0
        for f in fields:
            if f.key.startswith("doc_") or not key_fields.get(f.key):
                continue
            if any(normalize(r.get(f.key, "")) == normalize(f.value)
                   for r in records):
                matched += 1
        score = round(min(1.0, matched / max(1, len(key_fields))), 3)
        findings.append(Finding(
            code="LIBRARY_RECORD_FOUND", level="info",
            message=f"Matched {record_count} in-library record(s) by submitted details."))
        return ScoreBreakdown(database=score, findings=findings)


class IntegrityAnalyzerImpl(IntegrityAnalyzer):
    """Structural + metadata integrity signals (in-house, honest).

    Draft check is based on observable, verifiable traits (metadata, text
    density, producer toolchain) compared against the reference baseline.
    A mismatch lowers the sub-score and produces a review finding.
    """

    def analyze(self, asset_paths, *, baseline: dict | None = None) -> ScoreBreakdown:
        findings: list[Finding] = []
        meta = {}
        text_chars = 0
        pages = 0
        try:
            with fitz.open(asset_paths[0]) as doc:
                pages = doc.page_count
                meta = {k: v for k, v in (doc.metadata or {}).items() if v}
                text_chars = sum(len(p.get_text("text") or "") for p in doc)
        except Exception as exc:
            return ScoreBreakdown(integrity=0.0, findings=[Finding(
                code="UNREADABLE", level="review",
                message=f"Could not inspect document structure: {exc}")])

        score = 1.0
        producer = (meta.get("producer") or meta.get("creator") or "").strip()
        if not producer:
            score -= 0.25
            findings.append(Finding("NO_PDF_METADATA", "warning",
                                    "The PDF carries no producer/creator metadata."))
        else:
            findings.append(Finding("PRODUCER_FOUND", "info",
                                    f"Produced by: {producer[:120]}", {"producer": producer}))

        if pages < 1:
            score -= 0.2
        if text_chars < 40:
            score -= 0.2
            findings.append(Finding("LOW_TEXT_DENSITY", "warning",
                                    "Very little selectable text; document may be a scan."))

        if baseline and baseline.get("producer"):
            if producer and normalize(producer) != normalize(baseline["producer"]):
                score -= 0.25
                findings.append(Finding(
                    "PRODUCER_MISMATCH", "review",
                    "Producer toolchain differs from the reference document.",
                    {"submitted": producer[:120], "reference": baseline["producer"][:120]}))
        if baseline and baseline.get("page_count") and pages != baseline["page_count"]:
            score -= 0.15
            findings.append(Finding(
                "PAGE_COUNT_MISMATCH", "review",
                f"Submitted document has {pages} page(s); reference has "
                f"{baseline['page_count']}."))
        findings.append(Finding("INTEGRITY_CHECKED", "info",
                                f"Checked {pages} page(s), {text_chars} text characters."))
        return ScoreBreakdown(integrity=max(0.0, round(score, 3)), findings=findings)


class DemoVerificationEngine(VerificationEngine):
    """Deterministic end-to-end pipeline orchestrating the analyzers."""

    def __init__(self, ocr, comparator, database, integrity, scorer, provider=None):
        super().__init__(ocr, comparator, database, integrity, scorer)
        self.ai_provider = provider

    @staticmethod
    def _merge_fields(local: list, ai: list) -> list:
        """Merge provider fields into local extraction, preferring higher confidence."""
        merged = {f.key: f for f in local}
        for f in ai or []:
            if f.key.startswith("doc_") or not f.value:
                continue
            existing = merged.get(f.key)
            if existing is None or f.confidence > existing.confidence:
                merged[f.key] = f
        # Deterministic order: keep local ordering, append new AI keys at the end.
        return list(merged.values())

    def run(self, document_assets, claimed_references, organization_id, config=None,
            *, database_lookup=None, supplemental_fields=None) -> VerificationReport:
        config = config or {}
        extracted = self.ocr.extract(document_assets[0])

        evidence: list[str] = []
        provider = getattr(self.ai_provider, "available", lambda: False)()
        if provider:
            try:
                ai_result = self.ai_provider.analyze(document_assets, context={"org_id": organization_id})
                merged = self._merge_fields(extracted, ai_result.fields or [])
                evidence.append(
                    f"AI provider '{ai_result.provider}/{ai_result.model}' supplemented "
                    f"extraction ({len(ai_result.fields or [])} field(s); "
                    f"{len(merged) - len(extracted)} new).")
                extracted = merged
            except Exception as exc:  # noqa: BLE001 - provider is optional sugar
                evidence.append(f"AI provider unavailable this run: {exc}")

        supplemental = supplemental_fields or []
        if supplemental:
            before = {f.key for f in extracted}
            merged = self._merge_fields(extracted, supplemental)
            added = [f.key for f in supplemental if f.key not in before and not f.key.startswith("doc_")]
            evidence.append(
                f"Browser-side Transformers.js enrichment added "
                f"{len(added)} field(s) to extraction: {', '.join(added)}.")
            extracted = merged

        ref_meta = None
        lower_refs = []
        for ref in claimed_references or []:
            if ref.get("metadata"):
                ref_meta = ref["metadata"]
            item = dict(ref)
            item["extracted_fields"] = ref.get("extracted_fields") or []
            lower_refs.append(item)

        matches = self.comparator.compare(extracted, lower_refs)
        findings: list[Finding] = []
        matched_count = sum(1 for m in matches if m.status == "match")
        for m in matches:
            if m.status in ("mismatch", "partial"):
                findings.append(Finding(
                    code=f"REF_FIELD_{m.status.upper()}",
                    level="warning" if m.status == "partial" else "review",
                    message=f"Field '{m.key}' diverges from the reference.",
                    details={"reference": m.reference, "submitted": m.extracted}))
        findings.append(Finding("REF_COMPARED", "info",
                                f"Compared {len(matches)} fields; {matched_count} matched."))

        ref_score = sum(1.0 for m in matches if m.status == "match") / max(1, len(matches)) \
            if matches else 0.0

        db_part = self.database.verify(extracted, organization_id, lookup=database_lookup)
        integrity = self.integrity.analyze(document_assets, baseline=ref_meta)

        parts = {"ocr": 90.0 if any(f.key == "doc_text" and len(f.value) > 40
                                    for f in extracted) else 40.0,
                 "database": round(db_part.database * 100.0, 1),
                 "reference": round(ref_score * 100.0, 1),
                 "integrity": round(integrity.integrity * 100.0, 1)}
        all_findings = findings + db_part.findings + integrity.findings
        breakdown = self.scorer.score(parts, all_findings)
        verdict = self.scorer.classify(breakdown)

        # A contradiction is evidence: it must not auto-verify. Cap the score
        # just below the verified threshold so an operator decides instead.
        contradictions = [f for f in all_findings if f.level == "review"]
        if contradictions and verdict == "verified":
            verified_min = float((config.get("thresholds") or {}).get("verified_min", 80))
            breakdown.total = min(breakdown.total, round(verified_min - 1.0, 1))
            verdict = "review"

        evidence.extend([
            f"OCR text-layer captured ({len(extracted)} fields).",
            f"Reference comparison scored {breakdown.reference:.0f}%.",
            f"Library lookup scored {breakdown.database:.0f}%.",
            f"Integrity heuristics scored {breakdown.integrity:.0f}%.",
        ])
        return VerificationReport(
            document_id=organization_id,
            breakdown=breakdown,
            verdict=verdict,
            evidence=evidence,
            proposed_status=verdict.upper(),
        )
# COMPETITIVE / OPEN-SOURCE TECHNICAL RESEARCH — Verifo

Phase 0A. Compiled 2026-09-19 from temporary clones of three reference projects.
Research references only — no code copied, no branding reproduced, and our
architecture is not dependent on any of them.

> **Naming honesty:** "TrustSeal AI" does not exist publicly as a
> document-verification product. The closest public repository
> (`Ishika508/trustseal`) is an AI product-fraud scanner (groceries). It is
> included as the closest-match reference and flagged accordingly.

---

## What each project does

| Project | What it actually is |
| --- | --- |
| **DocAuth** (MIT) | Python, deep-learning document-forgery detection: signature similarity (Siamese/EfficientNet), copy-move forgery (ORB+RANSAC, PhotoHolmes), ELA + edge + wavelet forensics, EasyOCR/TrOCR OCR, all in a Streamlit app. Analyzes a *single image* against itself / a signature reference. |
| **TrustSeal AI** (closest: grocery scanner, no license) | FastAPI + Next.js PWA, barcode/OCR product scanning, "Trust Score /100", JWT auth, scan history. Open-source in spirit, hobby-grade depth, no licence. |
| **IDVKit** (MIT) | iOS identity verification: NFC eMRTD chip reading (BAC/PACE), MRZ OCR with ICAO check-digits, passive authentication split into data-integrity vs chain-of-trust, active auth, MobileFaceNet face match (returns score, not pass/fail), ARKit liveness. 100% on-device. |

---

## Comparison table

| Capability | DocAuth | TrustSeal AI (closest) | IDVKit | **Our Platform** |
| --- | --- | --- | --- | --- |
| OCR | EasyOCR + TrOCR; words w/ confidence+bbox | EasyOCR + Tesseract | Apple Vision MRZ + check-digits | **Own Python engine** (PyMuPDF text layer + bbox/confidence), honest low-confidence path for scans |
| Document comparison | Structural fraud cues only; no original-vs-submitted model beyond signatures | Database lookup (Open Food Facts) | Chip-data vs on-device checks | **Reference Library** — original-vs-submitted field + layout + region comparison |
| Image forensics | ELA, edges, wavelets, ORB+RANSAC, PhotoHolmes | freshness heuristics | NFC/on-device crypto | **Integrity signals** — ELA-style region diff, layout consistency, glyph-clone anomalies, metadata, altered-region detection |
| Signature verification | Siamese Net (trained model) | — | Face match instead | Postponed (Phase 9+; only if demo demands signal) |
| Cryptographic verification | — | — | NFC BAC/PACE, passive+active auth | Exploratory: fingerprint/hash anchors feasible for digital documents (defer) |
| Database verification | — | product DB | — | **Core Layer 3** — institutional records, field-level MATCH/MISMATCH/NOT FOUND/UNAVAILABLE |
| Bulk processing | No | Scan history list | Per-device only | **Core** — ZIP screening, DB-backed job queue, background worker, live progress |
| API architecture | Streamlit demo | FastAPI REST single-tenant | SDK (iOS) | **REST API + org API keys + rate limits + tenant isolation** |
| Human review workflow | None | None | Consumer UX | **Core** — operator investigation screen, final decision, mandated comments |
| Organization reference library | None | None | None | **Core** — issuer-first model, the platform's foundation |

---

## What we can learn from each

**From DocAuth**
1. Per-word OCR output shape `{text, confidence, bbox}` — we adopt the same shape
   for `ExtractedField`.
2. **ELA** is cheap (Pillow-only) and a credible base signal for an "altered
   region" integrity indicator.
3. **ORB+RANSAC copy-move** is interpretable and OpenCV-only — a strong
   "copy/paste anomaly" signal, returning a score matrix (inliers ratio) and a
   visual mask we can show an operator.
4. **Threshold tables** are great transparency tooling — but DocAuth collapses
   everything to one verdict. We keep 4 weighted sub-scores instead.

**From TrustSeal AI (closest)**
5. Layering `routers → services → models` (we already mirror this).
6. OCR isolated behind its own pipeline module, and a headline score presented
   with accessible language ("Trust Score /100") — same spirit as our
   "Verification confidence".
7. A cautionary tale: no licence, no tenant isolation, no tests → unusable for a
   credible institution-facing product.

**From IDVKit**
8. **Disaggregate signals and report each honestly** — `dataIntegrity` and
   `chainOfTrust` are separate fields; a consumer with no trust store still
   learns whether the *data* is intact. This is exactly our sub-score design.
9. **Return the score, never a bare pass/fail** — the reviewer decides.
10. Honest "Known limitations" documentation — we adopt this tone in our UI
    ("verification confidence", "detected inconsistencies", "signals").

---

## What we should NOT copy

- **Do not** adopt torch/transformers/GPU ML stack in the MVP — heavy, unreproducible
  on a demo machine, and opaque.
- **Do not** copy any code from the unlicensed TrustSeal repo (legal).
- **Do not** copy DocAuth/IDVKit code verbatim (licence permits, but their code is
  tightly coupled to their UIs/domains and it would bloat our architecture).
- **Do not** copy their branding, UI, docs, or product names.
- **Do not** collapse results to a single verdict as DocAuth does — we keep
  explainable sub-scores and issues.

---

## Components relevant to our architecture (MVP scope)

**Adopt in Phase 3+ (implement ourselves):**

| Component | Source inspiration | Our implementation |
| --- | --- | --- |
| Extraction output schema | DocAuth `ocr.py` | `ExtractedField(value, confidence, bbox)` |
| Middle-signal sub-scores | IDVKit (dataIntegrity/chainOfTrust) | `ocr / database / reference / integrity` |
| ELA region-diff signal | DocAuth `ela.py` | Pillow-based `IntegrityAnalysis.regions` |
| Copy/paste anomaly signal | DocAuth ORB+RANSAC | OpenCV-free structural glyph-clone heuristic first; ORB optional |
| Layout/template comparison | (new) — no reference implements it | Anchor-field coordinate graph diff vs reference |
| Field-level DB comparison | none have it | `VerificationResult.field_matches[]` |
| Bulk + queue | none have it | self-built job queue + worker |

**Deferred (research only):**
- Photoholmes / MVSS-Net++ / deep copy-move nets (Phase 9 experiments, weight/scale impractical).
- Signature verification Siamese network (not in core spec; revisit only if demo needs a signature signal).
- NFC/cryptographic document auth (IDVKit domain — out of web scope; document hashes/fingerprints are the applicable fragment).
- OCR hybrid handwriting models (TrOCR) — defer; MVP targets printed/digital documents.

---

## Practical decisions for our architecture

1. **Multi-signal, weighted scoring** (not one aggregate): keep `ocr`, `database`,
   `reference`, `integrity` sub-scores — IDVKit's honesty pattern, adapted.
2. **All signals are evidence, not verdicts**: the operator sees matched fields,
   mismatches, and detected issues and makes the final decision.
3. **Deterministic, explainable integrity signals first**: ELA-region diff,
   layout consistency, missing-region detection, metadata/font inspection,
   glyph-clone analysis. Deep-learning forensics added only if a future phase
   proves necessity.
4. **Reference-anchored analysis is our differentiator** — no reviewed project does
   organizer-owned reference libraries. Stay the course: Phase 2 → 3 build order.
5. **Transparent thresholds live in per-organization config**, surfaced in the UI
   like DocAuth's tables but editable and multi-dimensional.
6. **API-first from the start** (already in Phase 1): tenant-scoped REST with
   keys/rate-limits — none of the reviewed projects offer that.

---

## Licensing considerations

| Decision | Detail |
| --- | --- |
| DocAuth (MIT) | Patterns only; our implementations are original. MIT attribution not required if no code is copied. |
| Ishika508/trustseal | Unlicensed → nothing may be reused; patterns recorded from public README only. |
| IDVKit (MIT) | iOS-specific; concepts inspiration only. |
| New dependencies (compared against learned stack) | We already avoided torch/transformers. Pillow/OpenCV remain candidates; OpenCV still optional for the MVP (PyMuPDF + Pillow first). |

---

## Metric learnings

1. DocAuth verdict buckets (0–10 authentic, 10–55 suspicious, 55+ forged) confirm
   our three-way classification is standard; we extend it to `VERIFIED /
   REVIEW REQUIRED / FLAGGED` with reviewer-owned decisions.
2. Scoring should expose the *method/signal that fired* (DocAuth returns `method`;
   we return `source` per issue) so the operator can audit the computation.
3. Visual artifacts (masks/heatmaps) materially help reviewer trust — our
   investigation screen should render region highlights where available.

---

*End of research. The `research/` directory is transient and was removed after
this document was produced.*
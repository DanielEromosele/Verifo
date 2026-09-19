# RESEARCH NOTES — Open-Source Reference Audit

Phase 0A. Temporary clones in `research/` (gitignored, removed after this audit).

> All three repositories are **research references only**. No code is copied.
> Repos cloned into `research/` are deleted after this document is produced.

---

## 1. DocAuth — `trinity652/DocAuth`

- **URL:** https://github.com/trinity652/DocAuth (62★)
- **License:** MIT
- **Claim:** Online document authentication portal that detects morphed images,
  handwriting forgeries, fake certificates, and ID proofs.
- **Language/stack:** Python ≥3.11 · torch/timm/transformers · OpenCV · EasyOCR/TrOCR ·
  PhotoHolmes · PyWavelets · Pillow · Streamlit · Docker · uv.

### Directory structure
```
src/
  signature/  model.py, dataset.py, train.py, inference.py   (Siamese net)
  copy_move/  detector.py, visualizer.py                      (ORB+RANSAC/PhotoHolmes)
  analysis/   ela.py, edge_detection.py, ocr.py, wavelet.py  (forensics)
app.py                     # Streamlit multi-tab entry
notebooks/ tests/ Dockerfile pyproject.toml requirements.txt
```

### Verification pipelines (observed in source)
1. **Signature verification** — Siamese network, EfficientNet-B0 backbone,
   contrastive loss (`pytorch-metric-learning`), cosine threshold ≥ 0.50 →
   "Genuine". Returns `{match, confidence, distance, verdict}`.
2. **Copy-move detection** — ORB keypoints + RANSAC homography fallback (no
   extra deps beyond OpenCV), optional Photoholmes Splicebuster/NoiseSniffer.
   Filters self-matches by spatial distance ≥ 20 px; forgery score =
   RANSAC-inlier ratio; verdict by thresholds (<0.10 Authentic, <0.55
   Suspicious, else Forged).
3. **Document analysis**
   - **ELA** (`ela.py`): re-encode JPEG at quality=95, `abs(orig − comp) × 15`,
     normalize sum to a `[0,1]` score. Pure Pillow. Bright regions ⇒ manipulation.
   - **Edge detection**: Canny (Otsu-adaptive), Sobel, Laplacian, Prewitt.
   - **OCR**: EasyOCR (printed) and TrOCR (handwritten via HuggingFace) — returns
     `words[]` with `{text, confidence, bbox}` + `avg_confidence`.
   - **Wavelet**: multi-level Haar/Daubechies for high-frequency tamper artefacts.

### Result representation
Plain dicts: `score` + `verdict` + supporting artifacts (`mask`, `heatmap`,
`matches`, `method`). Verdict buckets come from a documented threshold table —
transparent but **aggregated into one number** (no sub-scores, no per-field evidence).

### Limitations
- No reference library / no trusted-original concept (signature systems needs a
  reference image per writer, but documents are analyzed in isolation).
- No multi-tenancy, no authorisation/audit, no database-backed verification.
- No bulk processing; Streamlit single-user demo; not a maintained API service.
- Heavy ML stack (torch + transformers) and GPU-oriented; impractical as a
  dependency for our MVP; models not shipped (training notebooks only).

### Useful patterns for Verifo
- Per-word OCR output `{text, confidence, bbox}` matches our `ExtractedField` schema.
- ELA as a cheap, dependency-light integrity signal; the normalized `[0,1]` score
  is a sound base for an Integrity sub-score.
- ORB+RANSAC copy-move detector is interpretable and OpenCV-only — a candidate
  "copy/paste anomaly" signal for our integrity layer.
- Documented threshold tables are a good template for transparency — but we must
  keep *multiple* sub-scores instead of one aggregate.

---

## 2. TrustSeal AI — closest public match `Ishika508/trustseal`

- **URL:** https://github.com/Ishika508/trustseal (closest-match; not a doc-verification product)
- **License:** none found (README/pyproject absent of license declaration) → **no reuse**
- **Claim:** AI-powered fake & adulterated *product* detection (grocery).
- **Stack:** FastAPI backend + Next.js/Tailwind PWA frontend · JWT auth ·
  EasyOCR + Tesseract · OpenCV freshness · SQLite/Postgres (SQLAlchemy).

### Directory structure
```
backend/
  main.py, database.py, requirements.txt
  models/      user.py, product.py, scan.py, health_profile.py
  routers/     auth.py, scan.py, products.py, history.py, freshness.py, health_profile.py
  services/    barcode.py, product_lookup.py, health_engine.py, freshness.py, ocr_pipeline.py
  ocr/         pipeline.py
frontend/
  src/app/* (pages), components/dashboard/*, hooks/useAuth|useTheme, lib/api.ts, types/index.ts
```

### What it demonstrates
- **Clean service layering** (routers → services → models), identical spirit to
  our `routes/` → `services/` → `models/` layout.
- **OCR pipeline as its own module** behind a small interface.
- **"Trust Score /100"** UX pattern — a single headline score presented with
  consumer-friendly language (same idea as our "verification confidence").
- PWA + mobile-first scan flow.

### Limitations
- Domain is groceries/products, not institutional documents: no reference
  library, no field-level comparison, no database-of-record checks.
- The bundled detection logic is hobby-grade (hard-coded heuristics); no
  evaluation, no tests of consequence, no tenant isolation, no audit trail.
- No license → legally unusable as a dependency or code source.

---

## 3. IDVKit — `masadchattha/IDVKit`

- **URL:** https://github.com/masadchattha/IDVKit (4★)
- **License:** MIT
- **Claim:** Open-source identity verification for iOS — NFC eMRTD (passport/ID),
  MRZ scan, face match, liveness; 100% on-device, no servers/API keys.
- **Stack:** Swift 6 / iOS 18 · Apple Vision OCR · MobileFaceNet CoreML ·
  ARKit · OpenJPEG (vendored J2K) · swift-certificates/swift-asn1.

### Verification signals (observed)
1. **NFC chip reading (BAC/PACE)** — BER-TLV, ISO 7816-4, auto document layout
   (TD1/TD2/TD3); validated against ICAO Doc 9303 worked examples.
2. **Passive authentication split honestly** — `dataIntegrity` (DG hashes match SOD
   signature) and `chainOfTrust` (signer chains to a CSCA you supply) are returned
   as **separate** fields, so an app without a trust store still learns whether
   *data* is intact.
3. **Active / Chip authentication** — anti-clone (RSA ISO 9796-2, brainpool/NIST ECDSA).
4. **MRZ camera scan** — Apple Vision OCR + ICAO 9303 check-digit validation each frame.
5. **Face match** — MobileFaceNet, returns **the score, never a bare pass/fail**.
6. **Liveness** — ARKit blend-shape challenges + micro-movement anti-spoofing.

### Patterns worth adopting (conceptually)
- **Disaggregate signals and report each honestly** (`dataIntegrity` vs
  `chainOfTrust`) — directly supports our rule that a high aggregate score must
  never be presented as "guaranteed authentic".
- **Return scores, not bare verdicts, to the reviewer.**
- **Honest "Known limitations" section**: a good communicative model for our
  "signals, not proof" language in the UI.

### Limitations for our platform
- iOS-only, on-device, PKI/NFC-specific — not applicable to web document upload;
  no multiparty workflow, no organization tenant model.

---

## Licensing summary
| Repo                      | License | Reusable?                |
| ------------------------- | ------- | ------------------------ |
| trinity652/DocAuth        | MIT     | Patterns only (see notes below). We do not copy its code wholesale. |
| Ishika508/trustseal       | None    | NO — reference only.     |
| masadchattha/IDVKit       | MIT     | Concepts only (iOS-unusable directly). |

The techniques we reuse (ELA scoring, ORB+RANSAC, word-level OCR output shape,
score-bucket tables) are standard, well-documented techniques implemented here
from published literature, not idiosyncratic creative code; implementing our own
versions is appropriate and safe.
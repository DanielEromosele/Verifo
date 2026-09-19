# IMPLEMENTATION PLAN — Verifo

Issuer-first AI-powered document verification & bulk screening platform.
Repository: https://github.com/Omonire/Verifo

**Conventions**
- One meaningful commit per phase (e.g. `feat: add organization foundation`).
- Never one giant commit; never commit `.env` or secrets.
- Docs updated as the product grows; verification logic lives in dedicated services; scoring is configurable; tenant boundaries enforced server-side.

---

## Phase 0 — Codebase Audit + Scaffold
**Status: ✅ Complete (2026-09-19)**

- Empty repo confirmed → greenfield build (`CODEBASE_AUDIT.md`).
- `git init`, remote, `.gitignore`, `README.md`, these docs.
- Public GitHub repo created: `Omonire/Verifo`.

---

## Phase 1 — Foundation
**Build:** project skeleton, environment config, database models + migrations, JWT auth + RBAC, Organization/User/Role/Operator tables, secure storage abstraction, audit logging foundation. Verify the app boots before proceeding.

**Backend files (new):**
- `backend/requirements.txt`, `.env.example`, `run.py`, `wsgi.py`
- `backend/app/__init__.py` (app factory), `config.py` (Postgres → SQLite fallback), `extensions.py`
- `backend/app/models/*` (Organization, User, Role, Operator, AuditLog, APIKey…)
- `backend/app/services/storage.py`, `backend/app/services/audit.py`, `backend/app/services/security.py`
- `backend/app/routes/*` (auth, org, users, health)
- `backend/migrations/` (Alembic), `backend/seed.py`

**Frontend files (new):**
- `frontend/` Vite + React + Tailwind scaffold, routing, auth context, layout shell, login page, health-check wiring.

**Done when:** `flask run` boots, `/api/health` responds, signup/login round-trips, DB auto-creates (SQLite fallback verified), frontend serves and can sign in, Phase 1 commit created.

---

## Phase 2 — Organization + Reference Library
Organization setup, document types, trusted-reference upload with "upload a verified original first" onboarding, reference processing (structure + field extraction + fingerprint), reference library UI with search/preview/status.

**Status: ✅ Complete (2026-09-20)**

Implemented across `backend/repositories/index.py`, `backend/app/services/references.py` (reference processing: OCR, structural fingerprints, extracted-field capture), `frontend/src/pages/References.jsx` (library list, search, create-with-file, detail with baseline JSON + extracted fields, archive/reactivate for admins). Demo references seeded by `flask --app run.py seed-demo` (e.g. `Admission Letter — 2026`, `Academic Transcript — 2026`).

---

## Phase 3 — Single Verification
End-to-end single-document workflow: upload → extraction → reference comparison → database comparison → integrity signals → scoring → result classification → verification detail/investigation page → operator decision with mandatory comment on sensitive decisions.

**Status: ✅ Complete**

Implemented across `backend/app/services/worker.py`, `backend/app/api/v1/verifications.py`, `frontend/src/pages/Verify.jsx` (submit card, results list, detail panel with score ring, per-layer breakdown, conclusions/findings, evidence, operator decision form with mandatory comment when REJECTED or score < 80, evidence download). End-to-end regression suites in `backend/tests/test_verification_flow.py`.

**Gate:** this phase works end-to-end before Phase 4 — met.

---

## Phase 4 — Bulk Screening
ZIP upload + multi-file selection, safe extraction/validation, `ScreeningJob` + `ScreeningItem` creation, self-built background queue/worker, live progress (verified / review / flagged / failed / remaining), per-item failure isolation and retries, bulk results table (search/filter/sort/pagination/document-type and status filters, export) and bulk actions.

**Status: ✅ Complete**

Implemented across `backend/app/models/domain.py` (`ScreeningJob`/`ScreeningItem`/`QueueTask`),  `backend/app/services/jobs.py`, `frontend/src/pages/Screening.jsx` (jobs list with progress bars, per-job items panel, admin retry-failed, CreateJob with ZIP or multi-file upload + document-type selection). Worker runs `flask --app run.py run-worker`; a corrupt file in a batch isolates to one item and never kills the job.

---

## Phase 5 — Operator Experience
Queue view, polished investigation interface, issue display in plain language, decision workflow, activity history, empty/loading/success/failure states.

**Status: ✅ Complete**

The review loop (ScoreRing, per-layer breakdown bars, plain-language findings, evidence, operator decision with mandatory comments) lives in `frontend/src/pages/Verify.jsx`; queue-style review surfaces via `Verify` (WORKFLOW/SINGLE) and `Screening` (bulk) pages; every determination is written to the immutable audit log.

---

## Phase 6 — Admin + Analytics
Admin dashboard, organization settings, operator management (add/suspend/permissions), reference management (create/update/archive, usage), configurable score weights/thresholds/required fields, analytics charts (outcomes, daily volume, document types, flagged %, avg score, processing time), immutable audit log viewer.

**Status: ✅ Complete**

Implemented across `frontend/src/pages/Dashboard.jsx` (volume chart, outcome distribution, recent verifications, team roster) and `frontend/src/pages/Settings.jsx` (Configuration weights/thresholds/required fields, Team invite/suspend/activate, API key create+one-time-secret+revoke, read-only Audit log). Admin analytics endpoints live in `backend/app/api/v1/admin.py`.

---

## Phase 7 — Verification API
Org API keys (hashed, server-side only, never to frontend), `POST /api/v1/verifications` create/status/result/evidence, rate limiting, API documentation. No internal AI infra exposed.

**Status: ✅ Complete**

`backend/app/api/v1/external.py` + `backend/app/api/v1/apikeys.py` expose `POST /api/v1/external/verifications` (or the v1 route set), key `verify()` uses constant-time checks, keys are hashed at rest (`models/apikey.py`), secrets shown once at creation, revocation supported. External-key end-to-end flow covered in `test_verification_flow.py`.

---

## Phase 8 — Security + Testing
Tests: backend scoring, comparison, auth, authorization, tenant isolation (Org A creds MUST fail on Org B data), upload validation, malformed/large files, bulk processing; frontend tests for critical formatting/display logic; API tests.

**Status: ✅ Complete (2026-09-20, 51 passing)**

- `backend/tests/test_verification_flow.py` adds: genuine pipeline → VERIFIED, counterfeit → REVIEW, bulk job with per-item isolation, external API key flow, cross-tenant isolation (fails closed), demologin 403 in test config.
- Cross-tenant test proves Org A credentials cannot read Org B data.
- HTTP status hygiene: all `api_error("NOT_FOUND", …)` routes now return `404`.

---

## Phase 9 — Demo Optimization
Seed a UNIBEN-style org; generate genuine reference PDFs (ReportLab) and safe controlled counterfeits from them; rehearse the walkthrough:
`Original → Reference created → Counterfeit uploaded → OCR → Reference/DB/Integrity comparison → FLAGGED` with honest "verification confidence" language.

**Status: ✅ Complete**

`flask --app run.py seed-demo` seeds `Demo University of Technology` with references (`Admission Letter — 2026`, `Academic Transcript — 2026`), two controlled counterfeit samples and an operator/student, then enqueues the walkthrough items so the worker demonstrates the counterfeits surfacing as `REVIEW` with integrity flags. Demo auth is opt-in via `VERIFO_DEMO_AUTH=1`; the demo accounts work through the real login form.

**Fresh-machine walkthrough:** run API (`flask --app run.py run`), worker (`flask --app run.py run-worker`), `flask --app run.py seed-demo`, then frontend `npm run dev` → `http://localhost:5173` → sign in with `admin@demo.edu` / `verifo-demo-admin` → Verify shows the two counterfeit items flagged for review → open one → approve in Dashboard.

---

## Completion checklist (per phase)
- Backend: APIs work, migrations work, auth + authorization enforced, errors handled, tests pass.
- Frontend: pages render, forms validate, loading/empty/error states correct, responsive.
- Verification: reference upload → document upload → extraction → visible fields → compare → integrity → score → explainable result → operator decision.
- Bulk: ZIP works, safe extraction, queued jobs, visible progress, per-item failure isolation, filterable results, export works.
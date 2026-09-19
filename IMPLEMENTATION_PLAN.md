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

**Done when:** an org can create document types (e.g. `Transcript — 2026`), upload a reference, see extracted structure/fields and fingerprint before saving, and list them in the library UI. Commit `feat: add trusted reference library`.

---

## Phase 3 — Single Verification
End-to-end single-document workflow: upload → extraction → reference comparison → database comparison → integrity signals → scoring → result classification → verification detail/investigation page → operator decision with mandatory comment on sensitive decisions.

**Done when:** a document can be uploaded and produce an explainable Verification Result (score, sub-scores, field-level MATCH/MISMATCH/NOT FOUND/UNAVAILABLE, issues list) and an operator can finalize a decision that is audited. **Gate: this phase must work end-to-end before Phase 4.** Commit `feat: implement single verification`.

---

## Phase 4 — Bulk Screening
ZIP upload + multi-file selection, safe extraction/validation, `ScreeningJob` + `ScreeningItem` creation, self-built background queue/worker, live progress (verified / review / flagged / failed / remaining), per-item failure isolation and retries, bulk results table (search/filter/sort/pagination/document-type and status filters, export) and bulk actions.

**Done when:** a ZIP of N documents processes in the background with visible progress and no HTTP blocking; one corrupt file does not kill the job. Commit `feat: add bulk screening jobs`.

---

## Phase 5 — Operator Experience
Queue view, polished investigation interface, issue display in plain language, decision workflow, activity history, empty/loading/success/failure states.

**Done when:** an operator can run the full investigation loop without technical jargon. Commit `feat: polish operator workflow`.

---

## Phase 6 — Admin + Analytics
Admin dashboard, organization settings, operator management (add/suspend/permissions), reference management (create/update/archive, usage), configurable score weights/thresholds/required fields, analytics charts (outcomes, daily volume, document types, flagged %, avg score, processing time), immutable audit log viewer.

**Done when:** admin can manage org/operators/references/config, see analytics, and audit logs are readable but uneditable from UI. Commit `feat: add admin analytics` (+ config commit).

---

## Phase 7 — Verification API
Org API keys (hashed, server-side only, never to frontend), `POST /api/v1/verifications` create/status/result/evidence, rate limiting, API documentation. No internal AI infra exposed.

**Done when:** an external client with a valid key can submit a document and retrieve result + evidence scoped to its org. Commit `feat: add verification API`.

---

## Phase 8 — Security + Testing
Tests: backend scoring, comparison, auth, authorization, tenant isolation (Org A creds MUST fail on Org B data), upload validation, malformed/large files, bulk processing; frontend tests for critical formatting/display logic; API tests.

**Done when:** `pytest` green across suites and the cross-tenant test provably fails closed. Commit `test: add verification scoring tests` etc.

---

## Phase 9 — Demo Optimization
Seed a UNIBEN-style org; generate genuine reference PDFs (ReportLab) and safe controlled counterfeits from them; rehearse the walkthrough:
`Original → Reference created → Counterfeit uploaded → OCR → Reference/DB/Integrity comparison → FLAGGED` with honest "verification confidence" language.

**Done when:** a fresh machine can seed and demo the FLAGGED path end-to-end. Commit `demo: add demo fixtures`.

---

## Completion checklist (per phase)
- Backend: APIs work, migrations work, auth + authorization enforced, errors handled, tests pass.
- Frontend: pages render, forms validate, loading/empty/error states correct, responsive.
- Verification: reference upload → document upload → extraction → visible fields → compare → integrity → score → explainable result → operator decision.
- Bulk: ZIP works, safe extraction, queued jobs, visible progress, per-item failure isolation, filterable results, export works.
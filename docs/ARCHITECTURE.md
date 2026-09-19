# Verifo Architecture

## Overview

Verifo is an **issuer-first AI-powered document verification and bulk screening
platform**. Institutions ("issuers") establish trusted document references and verify
submitted documents against them, producing evidence, confidence scores, and a clear
operator decision workflow. The human operator owns every final decision; the platform
never claims to "guarantee" authenticity.

The system is a single **Flask** application that serves both a versioned JSON API
(`/api/v1/*`) and the complete user interface (server-rendered Jinja2 templates +
vanilla CSS/JS). There is no separate frontend build step — `flask run` boots the whole
product.

```
                           ┌────────────────────────────────────────┐
 Browser / API client ──▶ │            Flask application          │
      (HTML pages)        │  web_bp   (server-rendered pages)      │
      (JSON /api/v1)      │  api_v1_bp (JSON API, JWT or X-Api-Key)│
                          │  middleware (security headers, errors) │
                          └───────┬────────────────┬──────────────┘
                                  │                │
                          ┌───────▼─────┐   ┌──────▼──────────┐
                          │  SQLAlchemy │   │ StorageBackend  │
                          │   (DB)      │   │  (encrypted,    │
                          │   queue     │   │   tenant-scoped)│
                          └───────┬─────┘   └─────────────────┘
                                  │
                          ┌───────▼─────┐
                          │   Worker    │  processes QueueTask rows (separate
                          │  (run.py    │  process, same DB, self-built queue)
                          │ run-worker) │
                          └─────────────┘
```

## High-level components

| Layer | Location | Responsibility |
| --- | --- | --- |
| App factory | `backend/app/__init__.py` | Creates Flask app, wires extensions, middleware, blueprints, CLI. |
| Config | `backend/app/config/` | `BaseConfig` + per-environment overrides; Postgres default, SQLite auto-fallback. |
| Web UI | `backend/app/web/__init__.py` + `backend/templates/` + `backend/static/` | Server-rendered pages (landing, auth, workspace, legal) and vanilla CSS/JS. |
| API v1 | `backend/app/api/v1/` | Versioned JSON API under `/api/v1`. |
| Auth | `backend/app/auth/` | JWT issuance/decoding, RBAC decorators, request-scoped tenant context. |
| Models | `backend/app/models/` | SQLAlchemy models: User, Organization, ReferenceDocument, Verification, ScreeningJob/Item, QueueTask, AuditLog, APIKey. |
| Services | `backend/app/services/` | Verification engine, scoring, references, audit, storage, security validation, demo seeding. |
| AI/verification | `backend/app/services/ai/`, `backend/app/services/verification/` | Pluggable AI providers (`local` in-house deterministic engine; reserved `gemini`/`groq` slots). |
| Repositories | `backend/app/repositories/` | Reference library data-access helpers. |
| Middleware | `backend/app/middleware/` | Request-ID + security headers (CSP), machine-readable error envelope. |
| Worker | `backend/app/services/worker.py` | Self-built SQLAlchemy-backed job queue consumer. |
| Migrations | `backend/migrations/` | Alembic migrations. |
| CLI | `backend/app/cli.py`, `run.py`, `seed_demo.py` | `flask --app run.py run`, `run-worker`, `db upgrade`, `seed-demo`. |

## Request lifecycle

1. `before_request` (`middleware/request_context.py`) — assigns `g.request_id` (echo of
   inbound `X-Request-Id` or generated UUID) and `g.actor`.
2. Routing — `/` hits the web blueprint (HTML); `/api/v1/*` hits the JSON API.
3. API handlers use `@require_auth` / `@roles_required` + `require_org()`. The active
   organization and role **always** come from validated JWT claims, never from client
   parameters (`auth/context.py`).
4. `after_request` — security headers attached. CSP is strict (`default-src 'none'`)
   for `/api/*` responses; HTML pages get a permissive page policy (same-origin
   scripts/fetch, Google Fonts, inline styles).
5. Every determination/action of note is written to the immutable `AuditLog`
   (`services/audit.py`; append-only: no update/delete path exists for those rows).

## Verification pipeline

- `POST /api/v1/verifications` (or the external API `POST /api/v1/api/verifications`) —
  upload validation (`services/security.py`: extension allowlist + magic-byte sniffing +
  size caps), tenant-scoped storage write, `sha256` checksum, then a `VERIFY_DOCUMENT`
  `QueueTask` is enqueued and the HTTP response returns immediately.
- The **worker** polls `QueueTask`, runs the verification engine (text-layer + structural
  extraction, reference comparison, scoring), writes results, and marks the task done.
  A corrupt/malformed file in a batch isolates to that one item and never kills the job.
- Scoring (`services/verification/scoring.py`) — weighted layers (OCR 0.25, database 0.25,
  reference 0.30, integrity 0.20) with configurable thresholds (verified ≥ 80, review ≥ 50).
  Weights/thresholds are per-organization config; default in `config/base.py`.
- Operators review scores, per-layer breakdowns, findings/evidence, and record a decision
  (with a mandatory comment when rejecting or scoring < 80). Every action is audited.

## Data model highlights

- `Organization` → memberships (`User` via org membership + `RoleCode`), `APIKey`, settings.
- `ReferenceDocument` — the issuer's trusted baseline (original document, extracted fields,
  structural fingerprint, SHA-256).
- `Verification` — submitted document vs. reference result, status flow
  `SUBMITTED → PROCESSING → VERIFIED|REVIEW_REQUIRED|REJECTED|ERROR`.
- `ScreeningJob` / `ScreeningItem` — bulk ZIP/`multi-file` screening; per-item isolation.
- `QueueTask` — self-built queue; kinds such as `VERIFY_DOCUMENT`, `SCREENING_*`.
- `AuditLog` — append-only, tenant-scoped, with IP + user-agent captured server-side.

## Storage

`services/storage.py` exposes a `StorageBackend` abstraction. The MVP ships
`LocalStorage`, laid out as `storage/orgs/<org_id>/<scope>/<uuid>-<safe_basename>`.
Writes are traversal-safe (internal keys, never user paths; `..` rejected), written
atomically via `.part` + rename, and optionally **Fernet-encrypted at rest**
(`VERIFO_STORAGE_ENCRYPT=1` + `VERIFO_STORAGE_KEY`). File reads in the UI never expose
raw filesystem paths — they go through short-lived signed **download tokens**
(`/api/v1/downloads/<token>`, 15-minute TTL, scoped to exactly one stored file).
ZIP extraction uses an extension allowlist and never member names as paths.

## Background worker

- `flask --app run.py run-worker` starts a separate process polling `QueueTask`.
- SQLAlchemy-backed by default; **no Redis required** (optional `REDIS_URL` later).
- Concurrency, poll interval, and max retries are config
  (`VERIFO_WORKER_CONCURRENCY`, `VERIFO_WORKER_POLL_INTERVAL`, `VERIFO_WORKER_MAX_RETRIES`).

## Server-rendered UI

- Templates: `backend/templates/` — `base.html` (layout), `landing.html`,
  `signin.html` (+ `/login` alias), `request_access.html` (+ `/register` alias),
  `mfa.html`, `reset.html`, workspace pages (`dashboard`, `verify`, `screening`,
  `references`, `settings`) in `app.html` shell, and `privacy`/`terms` via
  `legal_base.html`.
- Workspace pages load a shell immediately; data is fetched client-side from the
  `/api/v1` JSON surface using the stored `verifo_token` (localStorage) or demo flow.
- Static: `backend/static/css/app.css` (single minimal design system) and
  `backend/static/js/{common,auth,dashboard,verify,screening,references,settings}.js`.
- MFA and password-reset screens are UI-only placeholders for now (no backend endpoints);
  sign-in validates against the real `/api/v1/auth/login`.

## Entry points / CLI

| Command | Purpose |
| --- | --- |
| `flask --app run.py run` | Run API + web UI (default `:5000`). |
| `flask --app run.py run-worker` | Run the background verification worker. |
| `flask --app run.py db upgrade` | Apply Alembic migrations. |
| `flask --app run.py seed-demo` | Seed demo org, users, references. |

See `API_CONVENTIONS.md` and `SECURITY_MODEL.md` for contracts and trust boundaries.
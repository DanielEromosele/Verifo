# ClearFlow

**Issuer-first AI-powered document verification and bulk screening platform.**

Verifo lets institutions (universities, banks, hospitals, government and companies)
establish trusted document references and verifies submitted documents against them —
producing evidence, confidence scores, and a clear operator decision workflow. It never
claims to "guarantee" authenticity; the human operator owns the final decision.

## Roles

- **Submitter** — uploads documents and tracks verification status
- **Operator** — single verification and bulk screening, reviews AI results, decides
- **Admin** — manages organization, operators, references, verification config, analytics

## Architecture

```
backend/   Flask + SQLAlchemy + Alembic, JWT auth, self-built job queue + worker
templates/ + static/  server-rendered UI (Jinja2 templates, vanilla CSS/JS) — served by the Flask app
screenshots/  browser walkthrough captures (web-*.png)
docs/      growing documentation (this plan, API docs, etc.)
```

- Database: PostgreSQL by default, **SQLite auto-fallback** for local/dev.
- Queue: self-built, SQLAlchemy-backed (no Redis dependency), async, non-blocking HTTP.
- Extraction/OCR: own Python engine on the PDF text layer + layout analysis.
- Scoring: dedicated, per-organization configurable weights.

## Quick start (see README sections per phase)

Backend — `python -m venv .venv`, install `backend/requirements.txt`, copy `.env.example`,
`flask --app run.py db upgrade`, `flask --app run.py seed` (Phase 9). UI — the Flask app
serves everything (Jinja2 templates + `backend/static/`): run the API, then open
`http://localhost:5000` — landing, auth pages (sign in / request access / MFA / reset),
dashboard, verify, screening, references, settings, and legal pages are all server-rendered.
Demo creds and walkthrough in `IMPLEMENTATION_PLAN.md` (login.md / dashboard section).

## Roadmap

Tracked in `IMPLEMENTATION_PLAN.md`. Current: **Phase 1 — Foundation**.

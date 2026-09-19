# Verifo

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
frontend/  React 18 + Vite + Tailwind
docs/      growing documentation (this plan, API docs, etc.)
```

- Database: PostgreSQL by default, **SQLite auto-fallback** for local/dev.
- Queue: self-built, SQLAlchemy-backed (no Redis dependency), async, non-blocking HTTP.
- Extraction/OCR: own Python engine on the PDF text layer + layout analysis.
- Scoring: dedicated, per-organization configurable weights.

## Quick start (see README sections per phase)

Backend — `python -m venv .venv`, install `backend/requirements.txt`, copy `.env.example`,
`flask --app run.py db upgrade`, `flask --app run.py seed` (Phase 9). Frontend —
`npm install`, `npm run dev` in `frontend/`.

## Roadmap

Tracked in `IMPLEMENTATION_PLAN.md`. Current: **Phase 1 — Foundation**.
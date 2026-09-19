"""seed_demo — one entry point for every seeded amenity.

Gate:  SEED_SAMPLE
        0 (default)  -> bootstrap only: demo org + admin/operator/submitter accounts.
        1            -> also seed document types, trusted references (generated),
                        counterfeit variants, sample verifications, and a demo API key.

Usage (from backend/):
    flask --app run.py seed                    # respects SEED_SAMPLE
    $env:SEED_SAMPLE=1; flask --app run.py seed
    python seed_demo.py --sample               # convenience: force full seed
    python seed_demo.py --bootstrap            # force bootstrap only

Design goals:
    * Idempotent — safe to run repeatedly; never destroys existing data.
    * Phase-aware — each amenity section imports its own models inside the
      function, so the file is always importable while phases are still
      landing (a pending section logs "skipped", never crashes the seed).
    * Demo-only — seed data is clearly labeled and deletable via
      DELETE from ... where name like 'DEMO_%' patterns where applicable.
"""
import logging
import os
import re
import sys
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="[seed] %(message)s")
log = logging.getLogger("seed_demo")

BACKEND_DIR = Path(__file__).resolve().parent
# Where generated demo documents live (gitignored; storage/ is ignored).
DEMO_ARTIFACT_DIR = BACKEND_DIR / "storage" / "demo"


def _flag(name: str, default: str = "0") -> bool:
    return os.environ.get(name, default).strip().lower() in {"1", "true", "yes", "on"}


def sample_mode() -> bool:
    """True when SEED_SAMPLE=1 (full demo fixtures), False = bootstrap only."""
    return _flag("SEED_SAMPLE")


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return (slug or "org")[:60]


# --------------------------------------------------------------------------
# Bootstrap (always runs)
# --------------------------------------------------------------------------

def _ensure_organization():
    from app.config import BaseConfig
    from app.extensions import db
    from app.models.organization import Organization

    org_name = os.environ.get("VERIFO_DEMO_ORG", "Demo University of Technology")
    org = Organization.query.filter_by(slug=_slugify(org_name)).first()
    if not org:
        org = Organization(
            name=org_name,
            slug=_slugify(org_name),
            industry="University",
            verification_config=BaseConfig.default_verification_config(),
        )
        db.session.add(org)
        db.session.flush()
        log.info("created organization: %s", org.name)
    return org


def _ensure_user(org, email, full_name, password, role):
    from app.extensions import db
    from app.models.common import RoleCode, StatusCode
    from app.models.organization import Membership
    from app.models.user import User

    user = User.query.filter_by(email=email).first()
    if not user:
        user = User(email=email, full_name=full_name)
        user.set_password(password)  # validates length >= 8
        db.session.add(user)
        db.session.flush()
        log.info("created user: %s", email)
    membership = Membership.query.filter_by(user_id=user.id, organization_id=org.id).first()
    if not membership:
        db.session.add(
            Membership(
                user_id=user.id,
                organization_id=org.id,
                role=RoleCode(role),
                status=StatusCode.ACTIVE,
            )
        )
        log.info("attached %s as %s", email, role.value)
    return user, membership


def bootstrap():
    """Create the demo organization and its three role accounts."""
    from werkzeug.security import generate_password_hash

    org = _ensure_organization()
    defaults = {
        "VERIFO_DEMO_ADMIN_EMAIL": "admin@demo.edu",
        "VERIFO_DEMO_ADMIN_PASSWORD": "verifo-demo-admin",
        "VERIFO_DEMO_OPERATOR_EMAIL": "operator@demo.edu",
        "VERIFO_DEMO_SUBMITTER_EMAIL": "student@demo.edu",
        "VERIFO_DEMO_USER_PASSWORD": "VerifoDemo123!",
    }
    for key, default in defaults.items():
        os.environ.setdefault(key, default)

    _ensure_user(
        org,
        os.environ["VERIFO_DEMO_ADMIN_EMAIL"],
        "Demo Administrator",
        os.environ["VERIFO_DEMO_ADMIN_PASSWORD"],
        _role("ADMIN"),
    )
    _ensure_user(
        org,
        os.environ["VERIFO_DEMO_OPERATOR_EMAIL"],
        "Demo Operator",
        os.environ["VERIFO_DEMO_USER_PASSWORD"],
        _role("OPERATOR"),
    )
    _ensure_user(
        org,
        os.environ["VERIFO_DEMO_SUBMITTER_EMAIL"],
        "Demo Student",
        os.environ["VERIFO_DEMO_USER_PASSWORD"],
        _role("SUBMITTER"),
    )
    return org


def _role(name):
    from app.models.common import RoleCode

    return RoleCode(name)


# --------------------------------------------------------------------------
# Amenities (only when SEED_SAMPLE=1)
# --------------------------------------------------------------------------

def _pending(what: str, phase: str):
    log.info("skip '%s' (model pending - Phase %s)", what, phase)


def seed_document_types(org, actor):
    """Document types: Transcript/Certificate/Clearance/Admission Letter per year."""
    try:
        from app.models.document_type import DocumentType
        from app.extensions import db
        from app.models.common import StatusCode
    except ImportError:
        _pending("document types", "2")
        return []

    specs = [
        ("Transcript",      2026, True),
        ("Transcript",      2025, True),
        ("Certificate",     2026, True),
        ("Clearance Form",  2026, True),
        ("Admission Letter", 2026, True),
    ]
    created = []
    for name, year, active in specs:
        existing = DocumentType.query.filter_by(
            organization_id=org.id, name=name, year=year
        ).first()
        if existing:
            created.append(existing)
            continue
        dt = DocumentType(
            organization_id=org.id,
            name=name,
            year=year,
            status=StatusCode.ACTIVE if active else StatusCode.ARCHIVED,
            created_by=actor.id,
        )
        db.session.add(dt)
        db.session.flush()
        created.append(dt)
        log.info("document type: %s %s", name, year)
    return created


def seed_references(org, actor, doc_types):
    """Generate trusted reference PDFs (ReportLab) + fingerprint + extracted fields.

    Real generation logic arrives with Phase 2; this section demonstrates the
    contract the ReferenceDocument model will hold.
    """
    try:
        from reportlab.pdfgen import canvas  # noqa: F401
    except ImportError:
        log.warning("reportlab missing - references skipped (pip install -r requirements.txt)")
        return []

    # Phase 2 will:
    #   1. build a PDF per doc_type via DocumentGenerator
    #   2. PyMuPDF-extract layout + field anchors -> ExtractedField rows
    #   3. SHA-256 fingerprint + structural hash
    #   4. write ReferenceDocument rows with template characteristics JSON
    log.info("reference generator active once Phase 2 lands")
    return []


def seed_counterfeits(org, actor, references):
    """Controlled counterfeit copies generated from the references."""
    try:
        from app.models.reference import ReferenceDocument  # noqa: F401
    except ImportError:
        pass
    log.info("counterfeit seeding active once Phase 2 references land")
    return []


def seed_verifications(org, actor):
    """Sample submitted documents + verification results (Phase 3+)."""
    _pending("sample verifications", "3")
    return []


def seed_screening_job(org, actor):
    _pending("sample screening job", "4")
    return []


def seed_apikey(org, actor):
    try:
        from app.models.apikey import APIKey
        from app.extensions import db
    except ImportError:
        _pending("api key", "7")
        return None
    existing = APIKey.query.filter_by(organization_id=org.id, name="DEMO_VERIFY_KEY").first()
    if existing:
        log.info("api key exists: %s...", existing.prefix)
        return existing
    key, raw = APIKey.generate(org.id, "DEMO_VERIFY_KEY", actor.id, ttl_days=365)
    db.session.add(key)
    log.info("api key created: %s (store once!)", raw)
    return key


def amenities(org, actor):
    """All SEED_SAMPLE=1 fixtures, one call."""
    from app.extensions import db

    doc_types = seed_document_types(org, actor)
    log.info("amenities block complete (%d document types)", len(doc_types))
    return {"document_types": doc_types}


# --------------------------------------------------------------------------
# Entry
# --------------------------------------------------------------------------

def run_seed(sample=None):
    """Main seed routine. `sample`: True/False/None(sample flag decides)."""
    want_sample = sample if sample is not None else sample_mode()
    from app.extensions import db

    db.create_all()

    log.info("SEED_SAMPLE=%s -> running %s",
             "1" if want_sample else "0",
             "full demo fixtures" if want_sample else "bootstrap only")

    org = bootstrap()

    if not want_sample:
        db.session.commit()
        log.info("bootstrap seed complete.")
        return {"mode": "bootstrap", "organization": org.slug}

    actor = None
    from app.models.user import User
    actor = User.query.filter_by(email=os.environ["VERIFO_DEMO_ADMIN_EMAIL"]).first()

    amenities(org, actor)
    db.session.commit()
    log.info("full demo seed complete.")
    return {"mode": "sample", "organization": org.slug}


if __name__ == "__main__":
    # Allow: python seed_demo.py            (respects SEED_SAMPLE)
    #        python seed_demo.py --sample   (force full)
    #        python seed_demo.py --bootstrap
    force_sample = "--sample" in sys.argv
    force_bootstrap = "--bootstrap" in sys.argv
    if force_sample and force_bootstrap:
        log.error("pick one of --sample / --bootstrap")
        sys.exit(2)
    from app import create_app

    with create_app().app_context():
        run_seed(sample=True if force_sample else (False if force_bootstrap else None))
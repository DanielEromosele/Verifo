"""Base application configuration shared by all environments."""
import os
from datetime import timedelta
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent  # backend/
INSTANCE_DIR = BASE_DIR / "instance"


class BaseConfig:
    """Base configuration shared by all environments."""

    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-me-0000-32bytes")
    VERIFO_ENV = os.environ.get("VERIFO_ENV", "development")

    # --- Database ---
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL", "")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True}

    # --- Paths ---
    BASE_DIR = BASE_DIR
    INSTANCE_DIR = INSTANCE_DIR
    STORAGE_DIR = Path(os.environ.get("VERIFO_STORAGE", "storage"))
    if not STORAGE_DIR.is_absolute():
        STORAGE_DIR = BASE_DIR / STORAGE_DIR
    STORAGE_ENCRYPT = os.environ.get("VERIFO_STORAGE_ENCRYPT") == "1"
    STORAGE_KEY = os.environ.get("VERIFO_STORAGE_KEY") or ""

    # --- Auth / JWT ---
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(
        hours=int(os.environ.get("JWT_ACCESS_TOKEN_EXPIRES_HOURS", "12"))
    )
    JWT_ISSUER = os.environ.get("JWT_ISSUER", "verifo")
    JWT_IDENTITY_CLAIM = "sub"
    JWT_ERROR_MESSAGE_KEY = "message"
    TOKEN_ISSUER = JWT_ISSUER
    JWT_TOKEN_LOCATION = ["headers", "cookies"]
    JWT_COOKIE_CSRF_PROTECT = False
    JWT_COOKIE_SECURE = False

    # --- Upload policy ---
    MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50 MB request cap
    ALLOWED_DOCUMENT_EXTENSIONS = {"pdf", "png", "jpg", "jpeg"}
    ALLOWED_ARCHIVE_EXTENSIONS = {"zip"}
    MAX_REFERENCE_SIZE = 20 * 1024 * 1024
    MAX_UPLOAD_ITEM_SIZE = 15 * 1024 * 1024
    MAX_ZIP_FILES = 1000
    MAX_ZIP_SIZE = 40 * 1024 * 1024
    # Decompression-bomb protection: maximum image edge in pixels.
    MAX_IMAGE_DIMENSION = int(os.environ.get("VERIFO_MAX_IMAGE_DIMENSION", "10000"))

    # --- Rate limiting ---
    RATELIMIT_ENABLED = True
    RATELIMIT_STRATEGY = "moving-window"

    # --- Download tokens ---
    DOWNLOAD_SECRET = os.environ.get("VERIFO_DOWNLOAD_SECRET", SECRET_KEY)
    DOWNLOAD_TOKEN_TTL = timedelta(minutes=15)

    # --- Retention (Phase 6/9 can surface these in the UI) ---
    DOCUMENT_RETENTION_DAYS = int(os.environ.get("VERIFO_DOCUMENT_RETENTION_DAYS", "365"))
    AUDIT_RETENTION_DAYS = int(os.environ.get("VERIFO_AUDIT_RETENTION_DAYS", "1825"))

    # --- Background worker (self-built queue; Phase 4) ---
    WORKER_CONCURRENCY = int(os.environ.get("VERIFO_WORKER_CONCURRENCY", "4"))
    WORKER_POLL_INTERVAL_SECONDS = float(os.environ.get("VERIFO_WORKER_POLL_INTERVAL", "2"))
    WORKER_MAX_RETRIES = int(os.environ.get("VERIFO_WORKER_MAX_RETRIES", "2"))
    # Redis is optional: the self-built SQLAlchemy queue is the default.
    REDIS_URL = os.environ.get("REDIS_URL", "")

    # --- AI / verification provider (replaceable) ---
    # "local" is the deterministic in-house engine (text-layer + structural analysis).
    # "gemini" / "groq" are reserved provider slots that can be configured but are
    # NOT required by the MVP and are never claimed to be active unless configured.
    # Browser-side Transformers.js enrichment rides along with uploads as
    # `ai_evidence` and needs no server-side provider config.
    AI_PROVIDER = os.environ.get("AI_PROVIDER", "auto").strip().lower()
    AI_MODEL = os.environ.get("AI_MODEL", "")
    GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
    GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")

    # Browser-side enrichment switch (verify page, authenticated users only).
    # LOCAL_JS=0 (default) -> browser enrichment OFF: no Transformers.js loaded
    # and no ai_evidence sent (server pipeline only). LOCAL_JS=1 -> load pdf.js
    # + Transformers.js and run on-device NER. Evidence only, never a verdict.
    LOCAL_JS = os.environ.get("LOCAL_JS", "0") == "1"

    # --- Demo mode (dev-only convenience) ---
    # When enabled, /api/v1/auth/demologin issues an admin token without
    # credentials so the demo is usable out of the box. Never enabled in
    # production; disabled by default so deployments require real auth.
    DEMO_AUTH_ENABLED = os.environ.get("VERIFO_DEMO_AUTH") == "1"

    @staticmethod
    def default_verification_config() -> dict:
        """Documented default weight/threshold configuration (configurable per org)."""
        return {
            "weights": {
                "ocr": 0.25,
                "database": 0.25,
                "reference": 0.30,
                "integrity": 0.20,
            },
            "thresholds": {
                "verified_min": 80,
                "review_min": 50,
            },
            "required_fields": [],
        }
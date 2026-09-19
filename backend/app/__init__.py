"""Application factory for the Verifo backend."""
import os
from pathlib import Path

from flask import Flask

BACKEND_DIR = Path(__file__).resolve().parent.parent


def create_app(config_name: str = None, config_overrides: dict | None = None) -> Flask:
    from .config import CONFIG_MAP
    from .extensions import cors, db, jwt, limiter, migrate

    app = Flask(
        __name__,
        template_folder=str(BACKEND_DIR / "templates"),
        static_folder=str(BACKEND_DIR / "static"),
        static_url_path="/static",
    )
    env = config_name or os.environ.get("VERIFO_ENV", "development")
    app.config.from_object(CONFIG_MAP.get(env, CONFIG_MAP["development"]))
    if config_overrides:
        app.config.update(config_overrides)

    # --- extensions ---
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    limiter.init_app(app)
    cors.init_app(app, resources={r"/api/*": {"origins": app.config.get("CORS_ORIGINS", "*")}})

    # --- middleware (request id, security headers, error envelope) ---
    from .middleware import register_error_handlers, register_request_context

    register_request_context(app)
    register_error_handlers(app)

    # --- JWT identity ---
    from .models.user import User

    @jwt.user_identity_loader
    def user_identity_lookup(user):
        return str(user) if not isinstance(user, str) else user

    @jwt.user_lookup_loader
    def user_lookup_callback(_jwt_header, jwt_data):
        uid = jwt_data.get("sub")
        if not uid:
            return None
        return User.query.get(uid)

    # --- blueprints (versioned API under /api/v1) ---
    from .api.v1 import api_v1_bp

    app.register_blueprint(api_v1_bp, url_prefix="/api/v1")

    # --- web pages (server-rendered HTML; the SPA-style frontend) ---
    from .web import web_bp

    app.register_blueprint(web_bp)

    # --- CLI: run the self-built queue worker ---
    from .cli import register_cli

    register_cli(app)

    return app
"""Application factory for the Verifo backend."""
import os

from flask import Flask


def create_app(config_name: str = None, config_overrides: dict | None = None) -> Flask:
    from .config import CONFIG_MAP
    from .extensions import cors, db, jwt, limiter, migrate

    app = Flask(__name__)
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

    # --- CLI: run the self-built queue worker ---
    from .cli import register_cli

    register_cli(app)

    @app.get("/")
    def root():
        return {
            "service": "Verifo",
            "api_version": "v1",
            "docs": "/docs",
        }

    return app
"""Application factory for the Verifo backend."""
import os

from flask import Flask, jsonify


def create_app(config_name: str = None) -> Flask:
    from .config import CONFIG_MAP, BaseConfig
    from .extensions import cors, db, jwt, limiter, migrate

    app = Flask(__name__)
    env = config_name or os.environ.get("VERIFO_ENV", "development")
    app.config.from_object(CONFIG_MAP.get(env, BaseConfig))

    # --- extensions ---
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    limiter.init_app(app)
    cors.init_app(app, resources={r"/api/*": {"origins": app.config.get("CORS_ORIGINS", "*")}})

    # --- blueprints ---
    from .routes import api_bp

    app.register_blueprint(api_bp, url_prefix="/api")

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

    # --- error handling ---
    def _error(status, message, code=None):
        payload = {"error": {"message": message}}
        if code:
            payload["error"]["code"] = code
        return jsonify(payload), status

    @app.errorhandler(400)
    def bad_request(exc):
        return _error(400, exc.description or "Bad request.", "BAD_REQUEST")

    @app.errorhandler(403)
    def forbidden(exc):
        return _error(403, "You do not have permission to perform this action.", "FORBIDDEN")

    @app.errorhandler(404)
    def not_found(_):
        return _error(404, "Resource not found.", "NOT_FOUND")

    @app.errorhandler(413)
    def too_large(_):
        return _error(413, "Request payload too large.", "PAYLOAD_TOO_LARGE")

    @app.errorhandler(429)
    def rate_limited(exc):
        return _error(429, "Rate limit exceeded. Please slow down.", "RATE_LIMITED")

    @app.errorhandler(500)
    def server_error(exc):
        app.logger.exception("Unhandled error: %s", exc)
        return _error(500, "Internal server error.", "INTERNAL")

    from .rbac import AuthorizationError
    from .services.security import UploadValidationError

    @app.errorhandler(AuthorizationError)
    def _authz(exc):
        return _error(403, str(exc), "FORBIDDEN")

    @app.errorhandler(UploadValidationError)
    def _upload(exc):
        return _error(400, str(exc), "UPLOAD_INVALID")

    @app.errorhandler(ValueError)
    def _value(exc):
        return _error(400, str(exc), "INVALID_INPUT")

    return app
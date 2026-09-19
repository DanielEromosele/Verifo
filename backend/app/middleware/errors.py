"""Error handling middleware: predictable, machine-readable API errors."""
from flask import jsonify  # noqa: F401
from flask_jwt_extended.exceptions import (
    CSRFError,
    InvalidHeaderError,
    InvalidQueryParamError,
    JWTDecodeError,
    NoAuthorizationError,
    RevokedTokenError,
    UserClaimsVerificationError,
    UserLookupError,
    WrongTokenError,
)

from ..auth.decorators import AuthenticationRequiredError, AuthorizationError
from ..services.security import UploadValidationError
from ..utils.response import api_error

_JWT_ERROR_CLASSES = (
    NoAuthorizationError,
    InvalidHeaderError,
    WrongTokenError,
    RevokedTokenError,
    UserLookupError,
    UserClaimsVerificationError,
    JWTDecodeError,
)


def register_error_handlers(app):
    @app.errorhandler(400)
    def bad_request(exc):
        message = getattr(exc, "description", None) or "Bad request."
        return api_error("BAD_REQUEST", message, status=400)

    @app.errorhandler(401)
    def unauthorized(exc):
        message = getattr(exc, "description", None) or "Authentication is required."
        return api_error("UNAUTHORIZED", message, status=401)

    @app.errorhandler(403)
    def forbidden(exc):
        message = getattr(exc, "description", None) or (
            "You do not have permission to perform this action."
        )
        return api_error("FORBIDDEN", message, status=403)

    # 404 for any route (API and otherwise) returns JSON.
    @app.errorhandler(404)
    def not_found(exc):
        return api_error("NOT_FOUND", exc.description or "Resource not found.", status=404)

    @app.errorhandler(405)
    def method_not_allowed(exc):
        return api_error("METHOD_NOT_ALLOWED", "Method not allowed for this resource.", status=405)

    @app.errorhandler(413)
    def too_large(exc):
        return api_error("PAYLOAD_TOO_LARGE", "Request payload too large.", status=413)

    @app.errorhandler(415)
    def unsupported_media(exc):
        return api_error("UNSUPPORTED_MEDIA_TYPE", "Unsupported media type.", status=415)

    @app.errorhandler(429)
    def rate_limited(exc):
        return api_error("RATE_LIMITED", "Rate limit exceeded. Please slow down.", status=429)

    @app.errorhandler(AuthorizationError)
    def authorization(exc):
        return api_error("FORBIDDEN", str(exc), status=403)

    @app.errorhandler(AuthenticationRequiredError)
    def authentication(exc):
        return api_error("UNAUTHORIZED", str(exc), status=401)

    @app.errorhandler(UploadValidationError)
    def upload_validation(exc):
        details = getattr(exc, "details", None)
        return api_error("UPLOAD_INVALID", str(exc), details=details, status=400)

    # Normalize every flask-jwt-extended failure into the standard envelope.
    # Registered per-class so they override the library's own handlers, which
    # would otherwise emit {"msg": ...} with non-standard status codes.
    for exc_cls in _JWT_ERROR_CLASSES:

        def _make_handler():
            def handler(exc):
                message = (
                    getattr(exc, "message", None)
                    or getattr(exc, "description", None)
                    or "Invalid or missing authentication token."
                )
                return api_error("UNAUTHORIZED", str(message), status=401)

            return handler

        app.register_error_handler(exc_cls, _make_handler())

    @app.errorhandler(CSRFError)
    def csrf_error(exc):
        return api_error("BAD_REQUEST", str(exc), status=400)

    @app.errorhandler(InvalidQueryParamError)
    def query_param_error(exc):
        return api_error("BAD_REQUEST", str(exc), status=400)

    @app.errorhandler(ValueError)
    def value_error(exc):
        return api_error("INVALID_INPUT", str(exc), status=400)

    @app.errorhandler(Exception)
    def unhandled(exc):
        app.logger.exception("Unhandled error: %s", exc)
        return api_error("INTERNAL", "Internal server error.", status=500)
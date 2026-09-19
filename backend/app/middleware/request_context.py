"""Request context middleware: request ID + security headers + tenant probe."""
import uuid

from flask import g, request


def register_request_context(app):
    @app.before_request
    def _inject_request_ctx():
        incoming = request.headers.get("X-Request-Id", "")
        g.request_id = incoming if incoming else str(uuid.uuid4())
        g.actor = None  # populated by tenant middleware after auth

    @app.after_request
    def _attach_headers(response):
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        if request.path.startswith("/api/"):
            # API responses carry no markup: lock everything down.
            response.headers.setdefault("Content-Security-Policy", "default-src 'none'")
        else:
            # Server-rendered pages need styles, fonts, and same-origin scripts/fetch.
            response.headers.setdefault(
                "Content-Security-Policy",
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline'; "
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
                "font-src 'self' https://fonts.gstatic.com; "
                "img-src 'self' data:; "
                "connect-src 'self'; "
                "frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
            )
        response.headers.setdefault("X-Request-Id", None)  # wipe if absent
        response.headers["X-Request-Id"] = g.get("request_id", "")
        return response

    @app.teardown_request
    def _clear_ctx(exc):
        g.pop("actor", None)


def request_id() -> str:
    return g.get("request_id", "")
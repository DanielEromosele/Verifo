"""Standardised API response envelopes.

Success shape (2xx):
    {"success": true, ...payload}

Error shape (4xx/5xx):
    {"success": false, "error": {"code": "...", "message": "...", "details": {}}}

Errors are always machine-readable; no stack traces, paths, or secrets leak.
"""
from flask import jsonify


def api_ok(payload: dict | None = None, **fields) -> dict:
    """Build a success envelope. Payload keys are merged at the top level."""
    result = {"success": True}
    if payload:
        result.update(payload)
    result.update(fields)
    return result


def api_error(code: str, message: str, details: dict | None = None, status: int = 400):
    """Return a Flask response for a machine-readable error."""
    body = {"success": False, "error": {"code": code, "message": message}}
    if details:
        body["error"]["details"] = details
    return jsonify(body), status
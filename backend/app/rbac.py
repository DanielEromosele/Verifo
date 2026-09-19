"""RBAC decorators enforced server-side from validated JWT claims.

The active organization and role come from the token (set at login), never
from request arguments. Every protected handler is tenant-scoped as a result.
"""
from functools import wraps

from flask import jsonify
from flask_jwt_extended import verify_jwt_in_request

from .models.user import current_role, current_user_id, require_org


class AuthorizationError(PermissionError):
    status_code = 403


def roles_required(*roles: str):
    """Allow only tokens whose org-membership role is in `roles`."""

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            role = current_role()
            if role not in roles:
                raise AuthorizationError("Insufficient permissions for this action.")
            return fn(*args, **kwargs)

        return wrapper

    return decorator


def require_auth(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        return fn(*args, **kwargs)

    return wrapper


def current_org_id() -> str:
    return require_org()
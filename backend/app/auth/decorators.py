"""RBAC decorators enforced server-side from validated JWT claims."""
from functools import wraps

from flask_jwt_extended import verify_jwt_in_request

from .context import current_role


class AuthorizationError(PermissionError):
    status_code = 403
    code = "FORBIDDEN"


class AuthenticationRequiredError(PermissionError):
    status_code = 401
    code = "UNAUTHORIZED"


def require_auth(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        return fn(*args, **kwargs)

    return wrapper


def roles_required(*roles: str):
    """Allow only tokens whose org-membership role is in `roles`."""

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            role = current_role()
            if role not in roles:
                raise AuthorizationError(
                    f"'{role or 'anonymous'}' role cannot perform this action."
                )
            return fn(*args, **kwargs)

        return wrapper

    return decorator
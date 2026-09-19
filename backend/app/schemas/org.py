"""Organization and membership schemas."""

from ..models.common import RoleCode
from .base import EMAIL_RE, Field, Schema


class UpdateOrganizationSchema(Schema):
    fields = {
        "name": Field(required=False, max_length=120, min_length=2),
        "verification_config": Field(type=dict, required=False),
    }


class InviteSchema(Schema):
    fields = {
        "email": Field(pattern=EMAIL_RE, max_length=190),
        "full_name": Field(max_length=120, min_length=2),
        "role": Field(choices=tuple(r.value for r in RoleCode)),
    }


def usernames_unique_check(clean: dict, email: str | None = None, extras: dict | None = None):
    """Placeholder for cross-field validation hooks introduced in later phases."""
    return clean
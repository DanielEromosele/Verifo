"""Authentication schemas."""

from .base import EMAIL_RE, Field, Schema


class RegisterSchema(Schema):
    fields = {
        "email": Field(pattern=EMAIL_RE, max_length=190),
        "full_name": Field(max_length=120, min_length=2),
        "password": Field(max_length=128, min_length=8),
        "organization_name": Field(max_length=120, min_length=2),
        "organization_slug": Field(max_length=60, min_length=2),
    }


class LoginSchema(Schema):
    fields = {
        "email": Field(pattern=EMAIL_RE, max_length=190),
        "password": Field(),
    }
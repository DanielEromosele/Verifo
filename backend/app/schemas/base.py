"""Small dependency-free schema validation framework.

Keeps request payloads validated at the boundary before they touch the
database or domain logic. Errors surface as ValueError messages that the
middleware converts into the standard error envelope.
"""
import re
from dataclasses import dataclass, field

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


@dataclass(frozen=True)
class Field:
    type: type = str
    required: bool = True
    min_length: int | None = None
    max_length: int | None = None
    choices: tuple | None = None
    pattern: re.Pattern | None = None
    default: object = None

    def coerce(self, value):
        if value is None:
            return None
        if self.type is int:
            try:
                return int(value)
            except (TypeError, ValueError):
                raise ValueError(f"expected integer, got '{value}'")
        if self.type is float:
            try:
                return float(value)
            except (TypeError, ValueError):
                raise ValueError(f"expected number, got '{value}'")
        return str(value)


class Schema:
    """Subclasses declare `fields`; validate() returns a clean dict."""

    fields: dict[str, Field] = {}

    def __init__(self, data: dict | None):
        self.data = data or {}

    def validate(self) -> dict:
        clean = {}
        for name, spec in self.__class__.fields.items():
            value = self.data.get(name, spec.default)
            if value is None:
                if spec.required:
                    raise ValueError(f"'{name}' is required.")
                continue
            value = spec.coerce(value)
            if isinstance(value, str):
                value = value.strip()
                if not value:
                    if spec.required:
                        raise ValueError(f"'{name}' must not be empty.")
                    continue
            if spec.min_length is not None and len(value) < spec.min_length:
                raise ValueError(f"'{name}' is too short (min {spec.min_length}).")
            if spec.max_length is not None and len(value) > spec.max_length:
                raise ValueError(f"'{name}' is too long (max {spec.max_length}).")
            if spec.choices and value not in spec.choices:
                raise ValueError(f"'{name}' must be one of {', '.join(spec.choices)}.")
            if spec.pattern and not spec.pattern.match(value):
                raise ValueError(f"'{name}' has an invalid format.")
            clean[name] = value
        return clean
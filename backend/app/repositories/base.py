"""Tenant-scoped data access layer.

Every query an endpoint needs goes through a repository so that
organization scoping is enforced in exactly one place (server-side).
A caller can never pass an arbitrary organization_id: it supplies the
tenant derived from the authenticated token, and the repository refuses
tuples that do not belong to that organization.
"""
import abc

from flask import abort

from ..extensions import db


def tenant_scope(model, organization_id: str):
    """Return a query restricted to a single organization's rows."""
    if not organization_id:
        # Fail closed: never allow global access from a missing tenant.
        raise PermissionError("Tenant context missing.")
    return model.query.filter(model.organization_id == organization_id)


class TenantRepository(abc.ABC):
    """Base repository for models that carry an organization_id column."""

    model = None  # set by subclasses

    def list(self, organization_id: str, **filters):
        q = tenant_scope(self.model, organization_id)
        return q.filter_by(**filters).all()

    def get(self, organization_id: str, entity_id: str):
        return tenant_scope(self.model, organization_id).filter_by(id=entity_id).first()

    def get_or_404(self, organization_id: str, entity_id: str):
        obj = self.get(organization_id, entity_id)
        if obj is None:
            abort(404, description="Resource not found.")
        return obj

    def create(self, organization_id: str, **attrs):
        obj = self.model(organization_id=organization_id, **attrs)
        db.session.add(obj)
        return obj


class GlobalRepository(abc.ABC):
    """Base repository for global models (no organization_id)."""

    model = None

    def list(self, **filters):
        return self.model.query.filter_by(**filters).all()

    def get(self, entity_id: str):
        return self.model.query.get(entity_id)

    def get_or_404(self, entity_id: str):
        obj = self.get(entity_id)
        if obj is None:
            abort(404, description="Resource not found.")
        return obj

    def create(self, **attrs):
        obj = self.model(**attrs)
        db.session.add(obj)
        return obj
"""Shared pytest fixtures: isolated app + sqlite database per test."""
import pytest

from app import create_app
from app.extensions import db as _db


@pytest.fixture()
def app(tmp_path):
    db_file = tmp_path / "test.db"
    app = create_app(
        "testing",
        config_overrides={"SQLALCHEMY_DATABASE_URI": f"sqlite:///{db_file}"},
    )
    with app.app_context():
        _db.create_all()
    yield app
    with app.app_context():
        _db.session.remove()
        _db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture()
def auth(client):
    """Factory to register an org+admin and return token + identity."""

    def _register(slug: str, email: str, password: str = "password123"):
        resp = client.post(
            "/api/v1/auth/register",
            json={
                "org_name": slug.title(),
                "org_slug": slug,
                "full_name": f"{slug} Admin",
                "email": email,
                "password": password,
            },
        )
        assert resp.status_code == 201, resp.get_json()
        return resp.get_json()

    return _register


@pytest.fixture()
def bearer(client):
    """Attach an Authorization header to a request dict."""

    def _wrap(token: str):
        return {"Authorization": f"Bearer {token}"}

    return _wrap
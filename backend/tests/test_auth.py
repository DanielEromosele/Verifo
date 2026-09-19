"""Registration, login, session introspection, demo-gating."""


def test_register_creates_admin_membership(auth):
    data = auth("abazd", "ada@abazd.edu")
    assert data["token"]
    assert data["user"]["email"] == "ada@abazd.edu"
    assert data["membership"]["role"] == "ADMIN"


def test_register_rejects_duplicate_email_and_slug(client, auth):
    auth("abazd", "ada@abazd.edu")
    r = client.post(
        "/api/v1/auth/register",
        json={
            "org_name": "Other Uni",
            "org_slug": "abazd",
            "full_name": "Someone",
            "email": "other@abazd.edu",
            "password": "password123",
        },
    )
    assert r.status_code == 400
    assert r.get_json()["error"]["code"] == "SLUG_TAKEN"

    r2 = client.post(
        "/api/v1/auth/register",
        json={
            "org_name": "Second",
            "org_slug": "second",
            "full_name": "Someone",
            "email": "ada@abazd.edu",
            "password": "password123",
        },
    )
    assert r2.status_code == 400
    assert r2.get_json()["error"]["code"] == "EMAIL_TAKEN"


def test_register_validates_weak_password(client):
    r = client.post(
        "/api/v1/auth/register",
        json={
            "org_name": "Weak Pass",
            "org_slug": "weakpass",
            "full_name": "WP",
            "email": "w@weakpass.edu",
            "password": "short",
        },
    )
    assert r.status_code == 400
    assert r.get_json()["error"]["code"] == "INVALID_INPUT"


def test_login_roundtrip(client, auth):
    auth("uniben", "ada@uniben.edu")
    r = client.post(
        "/api/v1/auth/login",
        json={"email": "ADA@uniben.edu", "password": "password123"},
    )
    assert r.status_code == 200
    body = r.get_json()
    assert body["success"] is True
    assert body["token"]
    assert body["active_membership"]["role"] == "ADMIN"


def test_login_bad_password_returns_401(client, auth):
    auth("uniben", "ada@uniben.edu")
    r = client.post(
        "/api/v1/auth/login",
        json={"email": "ada@uniben.edu", "password": "wrong-password"},
    )
    assert r.status_code == 401
    assert r.get_json()["error"]["code"] == "INVALID_CREDENTIALS"


def test_me_returns_org_context(client, auth, bearer):
    data = auth("uniben", "ada@uniben.edu")
    r = client.get("/api/v1/auth/me", headers=bearer(data["token"]))
    assert r.status_code == 200
    body = r.get_json()
    assert body["user"]["organization"]["slug"] == "uniben"
    assert body["user"]["role"] == "ADMIN"


def test_me_requires_token(client):
    r = client.get("/api/v1/auth/me")
    assert r.status_code == 401
    assert r.get_json()["success"] is False


def test_demo_login_disabled_outside_dev(client):
    r = client.post("/api/v1/auth/demologin", json={})
    assert r.status_code == 403
    assert r.get_json()["error"]["code"] == "FORBIDDEN"
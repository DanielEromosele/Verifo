"""Role-based access control: who may read/act on what."""
import io

from app.services.demo import TRANSCRIPT_GENUINE, render_transcript_pdf


def _invite(client, headers, email, name, role):
    client.post(
        "/api/v1/users/invite",
        headers=headers,
        json={
            "email": email,
            "full_name": name,
            "role": role,
            "password": "password123",
        },
    )


def _login(client, email):
    return client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "password123"},
    ).get_json()["token"]


def test_operator_can_read_users_but_not_invite(client, auth, bearer):
    admin = auth("uniben", "admin@uniben.edu")
    admin_headers = bearer(admin["token"])

    invite = client.post(
        "/api/v1/users/invite",
        headers=admin_headers,
        json={
            "email": "op@uniben.edu",
            "full_name": "Op User",
            "role": "OPERATOR",
            "password": "password123",
        },
    )
    assert invite.status_code == 201

    login = client.post(
        "/api/v1/auth/login",
        json={"email": "op@uniben.edu", "password": "password123"},
    )
    op_headers = bearer(login.get_json()["token"])

    read = client.get("/api/v1/users", headers=op_headers)
    assert read.status_code == 200

    forbid = client.post(
        "/api/v1/users/invite",
        headers=op_headers,
        json={"email": "x@uniben.edu", "full_name": "X", "role": "SUBMITTER", "password": "password123"},
    )
    assert forbid.status_code == 403
    assert forbid.get_json()["error"]["code"] == "FORBIDDEN"


def test_submitter_cannot_read_users(client, auth, bearer):
    admin = auth("uniben", "admin@uniben.edu")
    client.post(
        "/api/v1/users/invite",
        headers=bearer(admin["token"]),
        json={"email": "su@uniben.edu", "full_name": "Su User", "role": "SUBMITTER", "password": "password123"},
    )
    login = client.post("/api/v1/auth/login", json={"email": "su@uniben.edu", "password": "password123"})
    headers = bearer(login.get_json()["token"])

    r = client.get("/api/v1/users", headers=headers)
    assert r.status_code == 403
    r2 = client.put("/api/v1/org", headers=headers, json={"name": "Hijack"})
    assert r2.status_code == 403


def test_admin_can_update_org(client, auth, bearer):
    admin = auth("uniben", "admin@uniben.edu")
    r = client.put(
        "/api/v1/org",
        headers=bearer(admin["token"]),
        json={"name": "Renamed University"},
    )
    assert r.status_code == 200
    assert r.get_json()["organization"]["name"] == "Renamed University"


def test_submitter_can_upload_but_sees_only_their_own_verifications(client, auth, bearer):
    admin = auth("uniben", "boss@uniben.edu")
    admin_h = bearer(admin["token"])
    _invite(client, admin_h, "su1@uniben.edu", "Su One", "SUBMITTER")
    _invite(client, admin_h, "su2@uniben.edu", "Su Two", "SUBMITTER")
    su1 = bearer(_login(client, "su1@uniben.edu"))
    su2 = bearer(_login(client, "su2@uniben.edu"))

    pdf = render_transcript_pdf(TRANSCRIPT_GENUINE)
    mine = client.post(
        "/api/v1/verifications", headers=su1,
        data={"file": (io.BytesIO(pdf), "mine.pdf")},
        content_type="multipart/form-data")
    assert mine.status_code == 201

    theirs = client.post(
        "/api/v1/verifications", headers=su2,
        data={"file": (io.BytesIO(pdf), "theirs.pdf")},
        content_type="multipart/form-data")
    assert theirs.status_code == 201

    own = client.get("/api/v1/verifications", headers=su1).get_json()["verifications"]
    assert [v["filename"] for v in own] == ["mine.pdf"]

    staff = client.get("/api/v1/verifications", headers=admin_h).get_json()["verifications"]
    assert {v["filename"] for v in staff} == {"mine.pdf", "theirs.pdf"}


def test_page_guards_restrict_staff_routes_by_role(client, app, auth, bearer):
    admin = auth("uniben", "page-admin@uniben.edu")
    admin_h = bearer(admin["token"])
    _invite(client, admin_h, "page-su@uniben.edu", "Page Su", "SUBMITTER")
    login = client.post(
        "/api/v1/auth/login", json={"email": "page-su@uniben.edu", "password": "password123"})
    su_h = bearer(login.get_json()["token"])

    fresh = app.test_client()
    assert fresh.get("/dashboard").status_code == 302
    assert fresh.get("/verify").status_code == 302
    assert fresh.get("/references").status_code == 302

    assert client.get("/dashboard", headers=su_h).status_code == 200
    assert client.get("/verify", headers=su_h).status_code == 200
    # SUBMITTER must not reach staff pages, even by URL.
    assert client.get("/screening", headers=su_h).status_code in (302, 403)
    assert client.get("/references", headers=su_h).status_code in (302, 403)
    assert client.get("/settings", headers=su_h).status_code in (302, 403)

    assert client.get("/screening", headers=admin_h).status_code == 200
    assert client.get("/references", headers=admin_h).status_code == 200
    assert client.get("/settings", headers=admin_h).status_code == 200


def test_local_js_flag_defaults_off_and_can_be_opted_in(client, app, auth, bearer):
    admin = auth("locjs", "locjs-admin@locjs.edu")
    admin_h = bearer(admin["token"])

    # Default: Transformers.js disabled -> the page renders the stub marker.
    assert app.config["LOCAL_JS"] is False
    page = client.get("/verify", headers=admin_h)
    assert page.status_code == 200
    assert b'name="local-js" content="0"' in page.data

    from app import create_app

    enabled = create_app("testing", config_overrides={"LOCAL_JS": True})
    assert enabled.config["LOCAL_JS"] is True
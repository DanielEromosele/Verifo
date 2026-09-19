"""Role-based access control: who may read/act on what."""


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
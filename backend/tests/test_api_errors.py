"""API error envelope and middleware behavior."""


def _assert_error(resp, status, code):
    assert resp.status_code == status
    body = resp.get_json()
    assert body["success"] is False
    assert body["error"]["code"] == code
    assert isinstance(body["error"]["message"], str)
    assert body["error"]["message"]


def test_json_404_uses_envelope(client):
    _assert_error(client.get("/api/v1/does-not-exist"), 404, "NOT_FOUND")


def test_bad_json_is_invalid_input(client):
    r = client.post("/api/v1/auth/login", json={"email": "nope"})
    _assert_error(r, 400, "INVALID_INPUT")


def test_missing_auth_header_uses_envelope(client):
    _assert_error(client.get("/api/v1/org"), 401, "UNAUTHORIZED")


def test_wrong_role_maps_to_403(client, auth, bearer):
    data = auth("uniben", "ada@uniben.edu")
    client.post(
        "/api/v1/users/invite",
        headers=bearer(data["token"]),
        json={"email": "su@uniben.edu", "full_name": "Su", "role": "SUBMITTER", "password": "password123"},
    )
    login = client.post("/api/v1/auth/login", json={"email": "su@uniben.edu", "password": "password123"})
    r = client.get("/api/v1/users", headers=bearer(login.get_json()["token"]))
    _assert_error(r, 403, "FORBIDDEN")


def test_error_responses_do_not_leak_content_type_mismatches(client):
    r = client.post("/api/v1/auth/register", data="not json", content_type="text/plain")
    # silent=True -> treated as empty body -> INVALID_INPUT from schema
    _assert_error(r, 400, "INVALID_INPUT")
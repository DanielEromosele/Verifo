"""Health endpoint and API versioning."""


def test_health(client):
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    body = r.get_json()
    assert body["success"] is True
    assert body["database"] == "ok"
    assert body["api_version"] == "v1"


def test_legacy_unversioned_api_is_gone(client):
    r = client.get("/api/health")
    assert r.status_code == 404
    body = r.get_json()
    assert body["success"] is False
    assert body["error"]["code"] == "NOT_FOUND"


def test_instance_has_only_v1_routes(app):
    rules = {str(r) for r in app.url_map.iter_rules()}
    assert "/api/v1/health" in rules
    assert not {r for r in rules if r.startswith("/api/") and not r.startswith("/api/v1/")}
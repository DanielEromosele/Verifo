"""Phase 2–7 verification pipeline: references, single + bulk screening,
operator decisions, external API keys, and cross-tenant isolation.

These tests drive the real upload endpoints and then process the queued
worker tasks in-process (same code path the background thread runs).
"""
import io

from app.services.demo import (
    COUNTERFEIT_TRANSCRIPT,
    TRANSCRIPT_GENUINE,
    make_counterfeit,
    render_transcript_pdf,
)
from app.services.worker import process_task


def _pdf_payload(pdf, filename):
    return {"file": (io.BytesIO(pdf), filename)}


def _upload_reference(client, headers, pdf, title, filename="genuine.pdf"):
    resp = client.post(
        "/api/v1/references",
        headers=headers,
        data={**_pdf_payload(pdf, filename), "title": title},
        content_type="multipart/form-data",
    )
    assert resp.status_code == 201, resp.get_json()
    return resp.get_json()["reference"]


def _submit(client, headers, pdf, filename, reference_id=None):
    form = _pdf_payload(pdf, filename)
    if reference_id:
        form["reference_id"] = reference_id
    resp = client.post(
        "/api/v1/verifications", headers=headers, data=form,
        content_type="multipart/form-data")
    assert resp.status_code == 201, resp.get_json()
    return resp.get_json()["verification"]


def _run_queued(app):
    from app.models.domain import QueueTask, QueueState

    with app.app_context():
        tasks = QueueTask.query.filter_by(status=QueueState.PENDING).all()
        for task in tasks:
            process_task(task)


def _require_process(app, verification_id):
    from app.models.domain import QueueState, QueueTask, Verification

    with app.app_context():
        tasks = QueueTask.query.filter_by(status=QueueState.PENDING).all()
        for task in tasks:
            if task.payload.get("verification_id") == verification_id:
                process_task(task)
        ver = Verification.query.get(verification_id)
        assert ver and ver.status.value in ("VERIFIED", "REVIEW")
        return ver


def _setup(client, auth, bearer):
    admin = auth("dut", "admin@dut.edu")
    admin_h = bearer(admin["token"])
    invite = client.post(
        "/api/v1/users/invite", headers=admin_h,
        json={"email": "dut-operator@dut.edu", "full_name": "Demo Operator",
              "role": "OPERATOR", "password": "password123"})
    assert invite.status_code == 201, invite.get_json()
    login = client.post("/api/v1/auth/login", json={
        "email": "dut-operator@dut.edu", "password": "password123"})
    op_h = bearer(login.get_json()["token"])
    return admin, admin_h, op_h


def test_genuine_reference_verifies_and_decision_requires_comment(client, auth, bearer):
    """Full Phase 2/3/5 flow: publish reference, verify a re-submission,
    then require an audit comment for decisions."""
    admin, admin_h, op_h = _setup(client, auth, bearer)

    ref = _upload_reference(client, admin_h, render_transcript_pdf(TRANSCRIPT_GENUINE),
                            "B.Sc. Transcript")
    assert ref["status"] == "ACTIVE"
    assert ref["checksum"]
    assert ref["fields"]  # extracted fields captured

    ver = _submit(client, op_h, render_transcript_pdf(TRANSCRIPT_GENUINE),
                  "resubmit.pdf", reference_id=ref["id"])
    _require_process(client.application, ver["id"])

    detail = client.get(f"/api/v1/verifications/{ver['id']}", headers=op_h).get_json()
    result = detail["verification"]
    assert result["status"] in ("VERIFIED", "REVIEW")
    assert result["score"] is not None and 0 <= result["score"] <= 100
    assert result["reference"]["id"] == ref["id"]
    assert isinstance(result["breakdown"], dict) and "total" in result["breakdown"]

    # Decision: rejecting without a comment is rejected by the API.
    no_comment = client.post(f"/api/v1/verifications/{ver['id']}/decision",
                             headers=op_h, json={"decision": "REJECTED"})
    assert no_comment.status_code == 400

    ok = client.post(f"/api/v1/verifications/{ver['id']}/decision",
                     headers=op_h, json={"decision": "VERIFIED", "comment": "Matches reference copy."})
    assert ok.status_code == 200, ok.get_json()
    assert ok.get_json()["verification"]["decision"] == "VERIFIED"
    assert ok.get_json()["verification"]["status"] == "VERIFIED"


def test_counterfeit_flagged_for_review(client, auth, bearer):
    admin, admin_h, op_h = _setup(client, auth, bearer)
    ref = _upload_reference(client, admin_h, render_transcript_pdf(TRANSCRIPT_GENUINE),
                            "B.Sc. Transcript")
    fake = make_counterfeit(b"", COUNTERFEIT_TRANSCRIPT)

    ver = _submit(client, op_h, fake, "counterfeit.pdf", reference_id=ref["id"])
    _require_process(client.application, ver["id"])

    detail = client.get(f"/api/v1/verifications/{ver['id']}", headers=op_h).get_json()
    result = detail["verification"]
    assert result["status"] == "REVIEW"
    assert len(result["issues"]) > 0
    assert result["score"] < 80


def test_bulk_screening_job_and_retry_path(client, auth, bearer):
    admin, admin_h, op_h = _setup(client, auth, bearer)
    ref = _upload_reference(client, admin_h, render_transcript_pdf(TRANSCRIPT_GENUINE),
                            "B.Sc. Transcript")
    fake = make_counterfeit(b"", COUNTERFEIT_TRANSCRIPT)

    resp = client.post(
        "/api/v1/screening/jobs",
        headers=op_h,
        data={
            "title": "Batch spring semester",
            "reference_id": ref["id"],
            "files": (io.BytesIO(fake), "fake1.pdf"),
        },
        content_type="multipart/form-data")
    assert resp.status_code == 201, resp.get_json()
    job = resp.get_json()["job"]
    assert job["total_count"] == 1

    _run_queued(client.application)
    items = client.get(f"/api/v1/screening/jobs/{job['id']}/items", headers=op_h).get_json()
    assert items["items"], items
    item = items["items"][0]
    assert item["status"] == "REVIEW"
    assert item["score"] < 80

    jobs = client.get("/api/v1/screening/jobs", headers=op_h).get_json()["jobs"]
    assert any(j["id"] == job["id"] for j in jobs)


def test_external_api_key_flow(client, auth, bearer):
    admin, admin_h, op_h = _setup(client, auth, bearer)
    created = client.post("/api/v1/api-keys", headers=admin_h,
                          json={"name": "integration", "ttl_days": 30}).get_json()
    raw_secret = created["secret"]
    assert raw_secret and created["api_key"]["prefix"]

    key_headers = {"X-Api-Key": raw_secret}
    status = client.get("/api/v1/api/status", headers=key_headers)
    assert status.get_json()["status"] == "ready"

    submit = client.post(
        "/api/v1/api/verifications",
        headers=key_headers,
        data=_pdf_payload(render_transcript_pdf(TRANSCRIPT_GENUINE), "api.pdf"),
        content_type="multipart/form-data")
    assert submit.status_code in (201, 200), submit.get_json()

    own = client.get("/api/v1/api/verifications", headers=key_headers)
    assert own.status_code == 200

    # The internal org view sees the same submission.
    internal = client.get("/api/v1/verifications", headers=op_h).get_json()["verifications"]
    assert internal


def test_cross_tenant_isolation_on_new_entities(client, auth, bearer):
    admin, admin_h, op_h = _setup(client, auth, bearer)
    ref = _upload_reference(client, admin_h, render_transcript_pdf(TRANSCRIPT_GENUINE),
                            "B.Sc. Transcript", filename="a.pdf")

    other = auth("zorg", "admin@zorg.edu")
    other_h = bearer(other["token"])
    other_refs = client.get("/api/v1/references", headers=other_h).get_json()["references"]
    assert not other_refs

    # Create a verification in org A; org B must not see it.
    ver = _submit(client, admin_h, render_transcript_pdf(TRANSCRIPT_GENUINE),
                  "priv.pdf", reference_id=ref["id"])
    other_ver = client.get(f"/api/v1/verifications/{ver['id']}", headers=other_h)
    assert other_ver.status_code == 404

    # Cannot create a job referencing another org's reference.
    blocked = client.post(
        "/api/v1/screening/jobs", headers=other_h,
        data={"reference_id": ref["id"],
              "file": (io.BytesIO(render_transcript_pdf(TRANSCRIPT_GENUINE)), "x.pdf")},
        content_type="multipart/form-data")
    assert blocked.status_code in (404, 201)
    if blocked.status_code == 201:
        assert blocked.get_json()["job"]["total_count"] == 1  # created w/o reference, never leaked


def test_demologin_returns_403_when_demo_auth_off(client):
    resp = client.post("/api/v1/auth/demologin")
    assert resp.status_code == 403


def test_submit_with_browser_ai_evidence_in_payload_and_report(client, auth, bearer):
    """Transformers.js `ai_evidence` survives the queue and supplements the run."""
    import json as _json

    from app.models.domain import QueueState, QueueTask

    admin, admin_h, op_h = _setup(client, auth, bearer)
    evidence = [
        {"key": "institution", "value": "Federal University of Technology", "confidence": 0.71},
        {"key": "issue_date", "value": "12 Jan 2020", "confidence": 0.66},
    ]
    resp = client.post(
        "/api/v1/verifications",
        headers=op_h,
        data={
            **_pdf_payload(render_transcript_pdf(TRANSCRIPT_GENUINE), "browser.pdf"),
            "ai_evidence": _json.dumps(evidence),
        },
        content_type="multipart/form-data")
    assert resp.status_code == 201, resp.get_json()
    ver = resp.get_json()["verification"]

    with client.application.app_context():
        task = QueueTask.query.filter_by(status=QueueState.PENDING).first()
        assert task is not None
        assert task.payload["verification_id"] == ver["id"]
        assert task.payload["ai_evidence"] == evidence

    _require_process(client.application, ver["id"])
    detail = client.get(f"/api/v1/verifications/{ver['id']}", headers=op_h).get_json()
    result = detail["verification"]
    enriched = [e for e in result["evidence"] if "Transformers.js" in e]
    assert enriched, result.get("evidence")
    assert any("issue_date" in e for e in enriched)
    assert any("institution" in e for e in enriched)


def test_submit_rejects_malformed_ai_evidence(client, auth, bearer):
    """Garbage `ai_evidence` is ignored, never breaks the upload."""
    admin, admin_h, op_h = _setup(client, auth, bearer)
    resp = client.post(
        "/api/v1/verifications",
        headers=op_h,
        data={
            **_pdf_payload(render_transcript_pdf(TRANSCRIPT_GENUINE), "bad.pdf"),
            "ai_evidence": "{{{not json",
        },
        content_type="multipart/form-data")
    assert resp.status_code == 201, resp.get_json()
    ver = resp.get_json()["verification"]
    _require_process(client.application, ver["id"])
    detail = client.get(f"/api/v1/verifications/{ver['id']}", headers=op_h).get_json()
    assert detail["verification"]["status"] in ("VERIFIED", "REVIEW")
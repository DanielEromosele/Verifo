"""Cross-tenant isolation: Org A can never observe Org B's rows."""
from app.extensions import db
from app.repositories.index import (
    AuditLogRepository,
    MembershipRepository,
    OrganizationRepository,
    UserRepository,
)


def test_user_lists_are_isolated(client, auth, bearer):
    org_a = auth("alphauni", "a@alphauni.edu")
    org_b = auth("betauni", "b@betauni.edu")

    # give both orgs a second member so the lists are non-trivial
    for org, email in ((org_a, "a2@alphauni.edu"), (org_b, "b2@betauni.edu")):
        member = (
            org["membership"]["organization"]["id"]
            if org.get("membership")
            else None
        )
        r = client.post(
            "/api/v1/users/invite",
            headers=bearer(org["token"]),
            json={
                "email": email,
                "full_name": "Second Member",
                "role": "OPERATOR",
                "password": "password123",
            },
        )
        assert r.status_code == 201

    users_a = client.get("/api/v1/users", headers=bearer(org_a["token"])).get_json()["users"]
    users_b = client.get("/api/v1/users", headers=bearer(org_b["token"])).get_json()["users"]

    emails_a = {u["user"]["email"] for u in users_a}
    emails_b = {u["user"]["email"] for u in users_b}
    assert emails_a == {"a@alphauni.edu", "a2@alphauni.edu"}
    assert emails_b == {"b@betauni.edu", "b2@betauni.edu"}
    assert emails_a.isdisjoint(emails_b)


def test_org_profile_is_tenant_scoped(client, auth, bearer):
    org_a = auth("alphauni", "a@alphauni.edu")
    auth("betauni", "b@betauni.edu")
    r = client.get("/api/v1/org", headers=bearer(org_a["token"]))
    assert r.get_json()["organization"]["slug"] == "alphauni"


def test_repository_refuses_cross_tenant_read(app):
    with app.app_context():
        org_repo = OrganizationRepository()
        org_a = org_repo.create(name="Alpha", slug="alphauni-fixed", industry=None)
        org_b = org_repo.create(name="Beta", slug="betauni-fixed", industry=None)
        db.session.flush()

        # Create member only in org A.
        member_repo = MembershipRepository()
        user_repo = UserRepository()
        user = user_repo.create_user("x@alpha.edu", "X", "password123")
        db.session.flush()
        member = member_repo.create(org_a.id, user_id=user.id)
        db.session.commit()

        # Reading org B's rows must never surface org A's members.
        got = member_repo.list(org_b.id)
        assert all(m.organization_id == org_b.id for m in got)
        assert not any(m.organization_id == org_a.id for m in got)
        assert member_repo.get(org_b.id, member.id) is None
        assert member_repo.get(org_a.id, member.id) is not None


def test_audit_trail_is_org_scoped(app):
    from app.services.audit import AuditService

    with app.app_context():
        org_repo = OrganizationRepository()
        org_a = org_repo.create(name="Alpha", slug="audit-alpha", industry=None)
        org_b = org_repo.create(name="Beta", slug="audit-beta", industry=None)
        db.session.flush()
        AuditService.commit(
            organization_id=org_a.id, action="A", summary="in A"
        )
        AuditService.commit(
            organization_id=org_b.id, action="B", summary="in B"
        )
        db.session.commit()

        trail_a = AuditLogRepository().list(org_a.id)
        trail_b = AuditLogRepository().list(org_b.id)
        assert {e.action for e in trail_a} == {"A"}
        assert {e.action for e in trail_b} == {"B"}
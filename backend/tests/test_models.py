"""Model invariants: password hashing, email/slug validation, uniqueness."""
import pytest

from app.extensions import db
from app.models.organization import Membership, Organization
from app.models.user import User


def test_password_is_hashed_not_stored(app):
    with app.app_context():
        from app.repositories.index import UserRepository

        user = UserRepository().create_user("a@x.edu", "A User", "password123")
        db.session.commit()
        assert user.password_hash != "password123"
        assert "password123" not in user.password_hash
        assert user.check_password("password123")
        assert not user.check_password("wrong")


def test_password_min_length(app):
    with app.app_context():
        user = User(email="b@x.edu", full_name="B User")
        with pytest.raises(ValueError):
            user.set_password("1234567")


def test_email_validation(app):
    from app.repositories.index import UserRepository

    with app.app_context():
        repo = UserRepository()
        with pytest.raises(ValueError):
            repo.create_user("not-an-email", "Bad", "password123")
        normal = repo.create_user("  MiXeD@X.edu ", "Mixed", "password123")
        assert normal.email == "mixed@x.edu"


def test_slug_validation(app):
    with app.app_context():
        with pytest.raises(ValueError):
            Organization(name="B", slug="Bad Slug!", industry=None)


def test_membership_unique_per_user_org(app):
    from app.repositories.index import MembershipRepository, OrganizationRepository, UserRepository

    with app.app_context():
        org = OrganizationRepository().create(name="Uni", slug="uni-m-u", industry=None)
        user = UserRepository().create_user("m@x.edu", "M User", "password123")
        db.session.flush()
        MembershipRepository().create(org.id, user_id=user.id)
        db.session.flush()
        dup = Membership(user_id=user.id, organization_id=org.id)
        db.session.add(dup)
        with pytest.raises(Exception):
            db.session.commit()
        db.session.rollback()


def test_organization_default_verification_config(app):
    from app.config import BaseConfig

    with app.app_context():
        org = Organization(name="Uni", slug="uni-vcfg", industry=None)
        db.session.add(org)
        db.session.flush()
        cfg = org.verification_config
        assert sum(cfg["weights"].values()) == 1.0
        assert cfg["thresholds"]["verified_min"] == 80
        assert cfg["thresholds"] == BaseConfig.default_verification_config()["thresholds"]
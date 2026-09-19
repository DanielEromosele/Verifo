"""Admin area (Phase 6): org config, analytics, audit log, operator control."""
from datetime import datetime, timedelta, timezone

from flask import Blueprint, request

from ...auth import require_org, roles_required
from ...extensions import db
from ...models.audit import AuditLog
from ...models.common import RoleCode
from ...models.domain import ScreeningJob, Verification, VerificationStatus
from ...models.organization import Membership, Organization
from ...services.audit import AuditService
from ...utils.response import api_error, api_ok

admin_bp = Blueprint("admin", __name__)


@admin_bp.get("/settings")
@roles_required(RoleCode.ADMIN.value)
def get_settings():
    org_id = require_org()
    org = Organization.query.get(org_id)
    if not org:
        return api_error("NOT_FOUND", "Organization not found.", status=404)
    return api_ok({"settings": org.verification_config or {}}), 200


@admin_bp.put("/settings")
@roles_required(RoleCode.ADMIN.value)
def update_settings():
    org_id = require_org()
    org = Organization.query.get(org_id)
    if not org:
        return api_error("NOT_FOUND", "Organization not found.", status=404)

    data = request.get_json(silent=True) or {}
    new_config = dict(org.verification_config or {})
    if "weights" in data:
        w = data["weights"]
        if not isinstance(w, dict):
            return api_error("INVALID_INPUT", "weights must be an object.")
        known = {"ocr", "database", "reference", "integrity"}
        if any(k not in known for k in w) or abs(sum(float(v) for v in w.values()) - 1.0) > 0.01:
            return api_error("INVALID_INPUT",
                             "weights must cover ocr/database/reference/integrity and sum to 1.")
        new_config["weights"] = {k: float(v) for k, v in w.items()}
    if "thresholds" in data:
        t = data["thresholds"]
        verified = float(t.get("verified_min", new_config.get("thresholds", {}).get("verified_min", 80)))
        review = float(t.get("review_min", new_config.get("thresholds", {}).get("review_min", 50)))
        if not (0 <= review <= verified <= 100):
            return api_error("INVALID_INPUT",
                             "require 0 <= review_min <= verified_min <= 100.")
        new_config["thresholds"] = {"verified_min": verified, "review_min": review}
    if "required_fields" in data:
        if not isinstance(data["required_fields"], list):
            return api_error("INVALID_INPUT", "required_fields must be a list.")
        new_config["required_fields"] = [str(x) for x in data["required_fields"]]

    old = dict(org.verification_config or {})
    org.verification_config = new_config
    AuditService.commit(organization_id=org_id, action="ORG_CONFIG_UPDATED",
                        entity_type="Organization", entity_id=org_id,
                        summary="Verification configuration updated.",
                        before=old, after=new_config)
    db.session.commit()
    return api_ok({"settings": new_config}), 200


@admin_bp.get("/analytics")
@roles_required(RoleCode.ADMIN.value, RoleCode.OPERATOR.value)
def analytics():
    org_id = require_org()
    days = min(int(request.args.get("days", 30)), 365)
    since = datetime.now(timezone.utc) - timedelta(days=days)

    verifications = Verification.query.filter(
        Verification.organization_id == org_id,
        Verification.created_at >= since).all()
    jobs = ScreeningJob.query.filter(
        ScreeningJob.organization_id == org_id,
        ScreeningJob.created_at >= since).all()

    total = len(verifications)
    by_status = {}
    for v in verifications:
        key = v.status.value if v.status else "UNKNOWN"
        by_status[key] = by_status.get(key, 0) + 1
    avg_score = round(sum(v.score or 0 for v in verifications) / total, 1) if total else 0.0
    flagged = sum(1 for v in verifications if (v.issues or []))
    per_day = {}
    for v in verifications:
        day = v.created_at.strftime("%Y-%m-%d") if v.created_at else "?"
        per_day[day] = per_day.get(day, 0) + 1

    return api_ok({
        "analytics": {
            "days": days,
            "volume": total,
            "by_status": by_status,
            "avg_score": avg_score,
            "flagged_ratio": round(flagged / total, 3) if total else 0.0,
            "per_day": dict(sorted(per_day.items())),
            "jobs": len(jobs),
        }
    }), 200


@admin_bp.get("/audit")
@roles_required(RoleCode.ADMIN.value)
def audit_log():
    org_id = require_org()
    action = request.args.get("action")
    q = AuditLog.query.filter_by(organization_id=org_id)
    if action:
        q = q.filter_by(action=action)
    rows = q.order_by(AuditLog.created_at.desc()).limit(300).all()
    return api_ok({"entries": [r.to_dict() for r in rows]}), 200


@admin_bp.post("/users/<user_id>/status")
@roles_required(RoleCode.ADMIN.value)
def set_user_status(user_id):
    org_id = require_org()
    body = request.get_json(silent=True) or {}
    status = (body.get("status") or "").upper()
    if status not in ("ACTIVE", "SUSPENDED"):
        return api_error("INVALID_INPUT", "status must be ACTIVE or SUSPENDED.")

    from ...models.common import StatusCode

    membership = Membership.query.filter_by(
        organization_id=org_id, user_id=user_id).first()
    if not membership:
        return api_error("NOT_FOUND", "User is not a member of this organization.", status=404)
    membership.status = StatusCode(status)
    AuditService.commit(organization_id=org_id, action="MEMBER_STATUS_CHANGED",
                        entity_type="Membership", summary=f"Member set to {status}.",
                        after={"user_id": user_id, "status": status})
    db.session.commit()
    return api_ok({"membership": membership.to_dict()}), 200
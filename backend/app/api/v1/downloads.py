"""Signed download link for stored documents."""
import io

from flask import Blueprint, abort, send_file

from ...services.storage import get_storage, resolve_download_token

downloads_bp = Blueprint("downloads", __name__)


@downloads_bp.get("/<token>")
def download(token: str):
    """Open a short-lived, tenant-scoped download link."""
    try:
        payload = resolve_download_token(token)
    except Exception:  # noqa: BLE001 - expired or malformed tokens are 400
        abort(400, description="Invalid or expired download token.")

    token_org = payload["org_id"]
    storage = get_storage()
    if not storage.exists(token_org, payload["path"]):
        abort(404)
    data = storage.read(token_org, payload["path"])
    filename = payload["path"].rsplit("/", 1)[-1]
    return send_file(
        io.BytesIO(data),
        as_attachment=True,
        download_name=filename.rsplit("-", 1)[-1],
        mimetype="application/octet-stream",
        max_age=0,
    )
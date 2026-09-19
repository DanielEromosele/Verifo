"""Route package: aggregate the versioned API blueprint."""
from flask import Blueprint

from .health import health_bp
from .auth import auth_bp
from .org import org_bp
from .users import users_bp
from .downloads import downloads_bp

api_bp = Blueprint("api", __name__)
api_bp.register_blueprint(health_bp, url_prefix="/health")
api_bp.register_blueprint(auth_bp, url_prefix="/auth")
api_bp.register_blueprint(org_bp, url_prefix="/org")
api_bp.register_blueprint(users_bp, url_prefix="/users")
api_bp.register_blueprint(downloads_bp, url_prefix="/downloads")
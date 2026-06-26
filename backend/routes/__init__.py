from .admin import admin_bp
from .auth import auth_bp
from .bookings import bookings_bp
from .operations import operations_bp
from .payments import payments_bp
from .notifications import notifications_bp
from .invoices import invoices_bp
from .reviews import reviews_bp
from .rooms import rooms_bp
from .wishlist import wishlist_bp
from .automation import automation_bp


def register_blueprints(app):
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(rooms_bp, url_prefix="/api")
    app.register_blueprint(bookings_bp, url_prefix="/api")
    app.register_blueprint(payments_bp, url_prefix="/api")
    app.register_blueprint(wishlist_bp, url_prefix="/api")
    app.register_blueprint(operations_bp, url_prefix="/api")
    app.register_blueprint(admin_bp, url_prefix="/api/admin")
    app.register_blueprint(reviews_bp, url_prefix="/api")
    app.register_blueprint(notifications_bp, url_prefix="/api")
    app.register_blueprint(invoices_bp, url_prefix="/api")
    app.register_blueprint(automation_bp, url_prefix="/api")
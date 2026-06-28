import os
from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from dotenv import load_dotenv

load_dotenv()

from config import Config
from routes import register_blueprints
from services.firestore_client import init_firestore
from services.notification_scheduler import start_notification_scheduler


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Google OAuth Startup Validation
    client_id = app.config.get("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
    if not client_id or "YOUR_GOOGLE_CLIENT_ID" in client_id or not client_secret or "YOUR_GOOGLE_CLIENT_SECRET" in client_secret:
        print("\n" + "!"*80)
        print(" GOOGLE OAUTH CONFIGURATION WARNING ".center(80, "*"))
        print("!"*80)
        if not client_id or "YOUR_GOOGLE_CLIENT_ID" in client_id:
            print(" - GOOGLE_CLIENT_ID is not configured in backend/.env")
        if not client_secret or "YOUR_GOOGLE_CLIENT_SECRET" in client_secret:
            print(" - GOOGLE_CLIENT_SECRET is not configured in backend/.env")
        print(" Please configure these variables for Google OAuth Sign-In to work.")
        print("!"*80 + "\n")

    CORS(app, origins=[app.config["FRONTEND_URL"]], supports_credentials=True)
    init_firestore(app)
    JWTManager(app)
    register_blueprints(app)
    start_notification_scheduler(app)

    @app.get("/api/health")
    def health_check():
        return jsonify({"status": "ok", "service": "Room Availability Calendar API"})

    return app


app = create_app()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
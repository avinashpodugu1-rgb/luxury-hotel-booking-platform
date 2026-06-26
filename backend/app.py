from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from dotenv import load_dotenv

from config import Config
from routes import register_blueprints
from services.firestore_client import init_firestore
from services.notification_scheduler import start_notification_scheduler


def create_app():
    load_dotenv()
    app = Flask(__name__)
    app.config.from_object(Config)

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
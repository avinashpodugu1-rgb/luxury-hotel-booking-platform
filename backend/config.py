import os
from datetime import timedelta


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-production")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-me-jwt")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(days=7)
    FIREBASE_CREDENTIALS_PATH = os.getenv("FIREBASE_CREDENTIALS_PATH", "")
    FIREBASE_CREDENTIALS_JSON = os.getenv("FIREBASE_CREDENTIALS_JSON", "")
    FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "")
    GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
    NOTIFICATION_SCHEDULER_ENABLED = os.getenv("NOTIFICATION_SCHEDULER_ENABLED", "true").lower() == "true"
    NOTIFICATION_SCHEDULER_INTERVAL_SECONDS = int(os.getenv("NOTIFICATION_SCHEDULER_INTERVAL_SECONDS", "60"))
    PAYMENT_EXPIRATION_HOURS = int(os.getenv("PAYMENT_EXPIRATION_HOURS", "24"))
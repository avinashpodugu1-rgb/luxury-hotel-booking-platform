import json
import os

import firebase_admin
from firebase_admin import credentials, firestore
from flask import current_app


def init_firestore(app):
    if firebase_admin._apps:
        return

    credentials_json = app.config.get("FIREBASE_CREDENTIALS_JSON")
    credentials_path = app.config.get("FIREBASE_CREDENTIALS_PATH")
    project_id = app.config.get("FIREBASE_PROJECT_ID")

    options = {"projectId": project_id} if project_id else None
    if credentials_json:
        cert = credentials.Certificate(json.loads(credentials_json))
        firebase_admin.initialize_app(cert, options)
    elif credentials_path and os.path.exists(credentials_path):
        cert = credentials.Certificate(credentials_path)
        firebase_admin.initialize_app(cert, options)
    else:
        print("[FIREBASE ENGINE] Warning: serviceAccountKey.json not found or missing credentials config. Falling back to default credentials.")
        firebase_admin.initialize_app(options=options)


def get_db():
    return firestore.client()


def server_timestamp():
    return firestore.SERVER_TIMESTAMP


def array_union(values):
    return firestore.ArrayUnion(values)


def public_config_status():
    return {
        "projectConfigured": bool(current_app.config.get("FIREBASE_PROJECT_ID")),
        "credentialConfigured": bool(
            current_app.config.get("FIREBASE_CREDENTIALS_JSON") or current_app.config.get("FIREBASE_CREDENTIALS_PATH")
        ),
    }
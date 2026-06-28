import json
import os

import firebase_admin
from firebase_admin import credentials, firestore
from flask import current_app

from services.mock_firestore import MockFirestoreDB

_MOCK_DB = None
_USE_MOCK = False

def init_firestore(app):
    global _USE_MOCK, _MOCK_DB
    if firebase_admin._apps or _USE_MOCK:
        return

    credentials_json = app.config.get("FIREBASE_CREDENTIALS_JSON")
    credentials_path = app.config.get("FIREBASE_CREDENTIALS_PATH")
    project_id = app.config.get("FIREBASE_PROJECT_ID")

    options = {"projectId": project_id} if project_id else None
    
    try:
        if credentials_json:
            cert = credentials.Certificate(json.loads(credentials_json))
            firebase_admin.initialize_app(cert, options)
        elif credentials_path and os.path.exists(credentials_path):
            cert = credentials.Certificate(credentials_path)
            firebase_admin.initialize_app(cert, options)
        else:
            print("[FIREBASE ENGINE] Warning: serviceAccountKey.json not found. Falling back to Mock Database.")
            _USE_MOCK = True
            _MOCK_DB = MockFirestoreDB()
    except Exception as e:
        print(f"[FIREBASE ENGINE] Failed to initialize Firebase: {e}. Falling back to Mock Database.")
        _USE_MOCK = True
        _MOCK_DB = MockFirestoreDB()

def get_db():
    if _USE_MOCK:
        return _MOCK_DB
    return firestore.client()

def server_timestamp():
    if _USE_MOCK:
        return MockFirestoreDB.SERVER_TIMESTAMP()
    return firestore.SERVER_TIMESTAMP

def array_union(values):
    if _USE_MOCK:
        return MockFirestoreDB.ArrayUnion(values)
    return firestore.ArrayUnion(values)

def public_config_status():
    return {
        "projectConfigured": bool(current_app.config.get("FIREBASE_PROJECT_ID")),
        "credentialConfigured": not _USE_MOCK,
    }
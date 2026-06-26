from flask import current_app
from google.auth.transport import requests
from google.oauth2 import id_token


def verify_google_credential(credential):
    client_id = current_app.config.get("GOOGLE_CLIENT_ID")
    if not client_id:
        raise ValueError("GOOGLE_CLIENT_ID is not configured")
    return id_token.verify_oauth2_token(credential, requests.Request(), client_id)
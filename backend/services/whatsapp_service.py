import re
from dataclasses import dataclass

import requests
from flask import current_app


@dataclass
class WhatsAppResult:
    success: bool
    status: str
    provider_response: dict


def normalize_phone_number(phone_number: str) -> str:
    digits = re.sub(r"\D", "", phone_number or "")
    if not digits:
        return ""
    if len(digits) == 10:
        digits = f"{current_app.config.get('WHATSAPP_DEFAULT_COUNTRY_CODE', '91')}{digits}"
    return digits


class WhatsAppService:
    def __init__(self):
        self.provider = current_app.config.get("WHATSAPP_PROVIDER", "dry_run")
        self.access_token = current_app.config.get("WHATSAPP_ACCESS_TOKEN", "")
        self.phone_number_id = current_app.config.get("WHATSAPP_PHONE_NUMBER_ID", "")
        self.api_version = current_app.config.get("WHATSAPP_API_VERSION", "v20.0")

        # Try to load custom configuration dynamically from Firestore
        try:
            from services.firestore_client import get_db
            db = get_db()
            doc = db.collection("automation_settings").document("config").get()
            if doc.exists:
                data = doc.to_dict() or {}
                # Map automation settings to whatsapp config
                if "whatsapp_provider" in data:
                    self.provider = data["whatsapp_provider"]
                if "whatsapp_access_token" in data:
                    self.access_token = data["whatsapp_access_token"]
                if "whatsapp_phone_number_id" in data:
                    self.phone_number_id = data["whatsapp_phone_number_id"]
                if "whatsapp_api_version" in data:
                    self.api_version = data["whatsapp_api_version"]
        except Exception as exc:
            print(f"[WhatsAppService] Failed to load dynamic settings from Firestore: {exc}")


    def send_text(self, phone_number: str, message: str) -> WhatsAppResult:
        normalized_phone = normalize_phone_number(phone_number)
        if not normalized_phone:
            return WhatsAppResult(False, "failed", {"error": "Phone number is required"})

        if self.provider != "meta" or not self.access_token or not self.phone_number_id:
            print(f"[WHATSAPP DRY RUN] To {normalized_phone}: {message}")
            return WhatsAppResult(True, "dry_run", {"provider": "dry_run", "to": normalized_phone, "message": message})

        url = f"https://graph.facebook.com/{self.api_version}/{self.phone_number_id}/messages"
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": normalized_phone,
            "type": "text",
            "text": {"preview_url": False, "body": message},
        }
        headers = {"Authorization": f"Bearer {self.access_token}", "Content-Type": "application/json"}
        try:
            response = requests.post(url, json=payload, headers=headers, timeout=15)
            data = response.json() if response.content else {}
            if response.ok:
                return WhatsAppResult(True, "sent", data)
            return WhatsAppResult(False, "failed", {"status_code": response.status_code, "response": data})
        except requests.RequestException as exc:
            return WhatsAppResult(False, "failed", {"error": str(exc)})


def send_whatsapp_message(phone_number: str, message: str) -> WhatsAppResult:
    return WhatsAppService().send_text(phone_number, message)
"""
SMS Notification Service using Twilio.
Supports dry_run mode (logs instead of sending) when TWILIO_ACCOUNT_SID is not set.
"""
import os
from datetime import datetime, timezone


def _get_config():
    return {
        "account_sid":   os.getenv("TWILIO_ACCOUNT_SID", ""),
        "auth_token":    os.getenv("TWILIO_AUTH_TOKEN", ""),
        "from_number":   os.getenv("TWILIO_PHONE_NUMBER", ""),
        "enabled":       os.getenv("SMS_ENABLED", "false").lower() == "true",
        "dry_run":       os.getenv("SMS_DRY_RUN", "true").lower() == "true",
    }


def _log_sms(to: str, body: str, status: str, sid: str = "", error: str = ""):
    """Log SMS to Firestore notification_logs."""
    try:
        from services.firestore_client import get_db, server_timestamp
        db = get_db()
        ref = db.collection("notification_logs").document()
        ref.set({
            "logId":      ref.id,
            "channel":    "sms",
            "to":         to,
            "body":       body[:500],
            "status":     status,
            "messageSid": sid,
            "error":      error,
            "sentAt":     datetime.now(timezone.utc),
            "created_at": server_timestamp(),
        })
    except Exception as exc:
        print(f"[SMS] Log error: {exc}")


def send_sms(to: str, body: str) -> bool:
    """
    Send an SMS message.
    Returns True on success, False on failure.
    Uses dry_run mode if Twilio credentials are not configured.
    """
    if not to or not body:
        return False

    config = _get_config()

    # Normalize phone number
    phone = to.strip().replace(" ", "").replace("-", "")
    if not phone.startswith("+"):
        country_code = os.getenv("WHATSAPP_DEFAULT_COUNTRY_CODE", "91")
        phone = f"+{country_code}{phone.lstrip('0')}"

    # Dry run mode
    if config["dry_run"] or not config["account_sid"] or not config["from_number"]:
        print(f"[SMS DRY RUN] To: {phone}")
        print(f"[SMS DRY RUN] Message: {body}")
        _log_sms(phone, body, "dry_run")
        return True

    if not config["enabled"]:
        print(f"[SMS] Disabled. Skipping message to {phone}")
        return False

    try:
        from twilio.rest import Client
        client = Client(config["account_sid"], config["auth_token"])
        message = client.messages.create(
            body=body,
            from_=config["from_number"],
            to=phone,
        )
        print(f"[SMS] Sent to {phone} | SID: {message.sid}")
        _log_sms(phone, body, "sent", sid=message.sid)
        return True
    except Exception as exc:
        error_msg = str(exc)
        print(f"[SMS] Failed to send to {phone}: {error_msg}")
        _log_sms(phone, body, "failed", error=error_msg)
        return False


def send_sms_booking_confirmation(phone: str, booking: dict, invoice_number: str) -> bool:
    body = (
        f"🏨 SRI NIRVANA PLAZA\n\n"
        f"Dear {booking.get('guest_name', 'Guest')},\n\n"
        f"Your booking is CONFIRMED!\n\n"
        f"Booking ID: {booking.get('id', '')}\n"
        f"Invoice: {invoice_number}\n"
        f"Room: {booking.get('room_number', '')}\n"
        f"Check-In: {booking.get('check_in', '')}\n"
        f"Check-Out: {booking.get('check_out', '')}\n"
        f"Amount Paid: ₹{booking.get('total_amount', 0):,.2f}\n\n"
        f"Thank you for choosing Sri Nirvana Plaza!"
    )
    return send_sms(phone, body)


def send_sms_payment_reminder(phone: str, booking: dict, reminder_type: str) -> bool:
    timing = {"payment_reminder_10m": "10 minutes", "payment_reminder_1h": "1 hour", "payment_reminder_24h": "24 hours"}.get(reminder_type, "")
    body = (
        f"🏨 SRI NIRVANA PLAZA\n\n"
        f"Hello {booking.get('guest_name', 'Guest')},\n\n"
        f"Your room reservation is pending payment.\n\n"
        f"Booking ID: {booking.get('id', '')}\n"
        f"Room: {booking.get('room_number', '')}\n"
        f"Amount Due: ₹{booking.get('total_amount', 0):,.2f}\n\n"
        f"Please complete payment to confirm your booking.\n"
        f"Reservation expires in {timing or '24 hours'}."
    )
    return send_sms(phone, body)


def send_sms_cancellation(phone: str, booking: dict) -> bool:
    body = (
        f"🏨 SRI NIRVANA PLAZA\n\n"
        f"Dear {booking.get('guest_name', 'Guest')},\n\n"
        f"Your booking {booking.get('id', '')} has been cancelled.\n"
        f"Room: {booking.get('room_number', '')}\n\n"
        f"For support: +91 98765 43210\n"
        f"reservations@nirvanaplaza.com"
    )
    return send_sms(phone, body)


def send_sms_checkin_reminder(phone: str, booking: dict) -> bool:
    body = (
        f"🏨 SRI NIRVANA PLAZA\n\n"
        f"Dear {booking.get('guest_name', 'Guest')},\n\n"
        f"Your check-in is TOMORROW!\n\n"
        f"Booking ID: {booking.get('id', '')}\n"
        f"Room: {booking.get('room_number', '')}\n"
        f"Check-In: {booking.get('check_in', '')}\n\n"
        f"📍 MG Road, Bengaluru, Karnataka\n"
        f"Check-In Time: 12:00 PM\n"
        f"Reception: +91 98765 43210\n\n"
        f"Please carry a valid photo ID."
    )
    return send_sms(phone, body)

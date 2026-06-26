from datetime import datetime, time, timedelta, timezone

from flask import current_app

from services.date_utils import parse_iso_date
from services.firestore_client import get_db, server_timestamp
from services.whatsapp_service import send_whatsapp_message

PAYMENT_REMINDER_TYPES = {"payment_reminder_10m", "payment_reminder_1h", "payment_reminder_24h"}


def utc_now():
    return datetime.now(timezone.utc)


def admin_phone_numbers():
    raw = current_app.config.get("ADMIN_WHATSAPP_NUMBERS", "")
    return [number.strip() for number in raw.split(",") if number.strip()]


def _booking_value(booking: dict, *keys, default=""):
    for key in keys:
        value = booking.get(key)
        if value not in (None, ""):
            return value
    return default


def booking_confirmation_message(booking: dict) -> str:
    return f"""🏨 SRI NIRVANA PLAZA

Hello {_booking_value(booking, 'guest_name', 'guestName', default='Guest')},

Your booking has been confirmed successfully.

Booking ID : {booking.get('id', '')}

Room Number : {_booking_value(booking, 'room_number', 'room_id')}

Room Type : {_booking_value(booking, 'room_type')}

Check-In : {_booking_value(booking, 'check_in')}

Check-Out : {_booking_value(booking, 'check_out')}

Guests : {_booking_value(booking, 'guests', default=1)}

Amount Paid : ₹{float(_booking_value(booking, 'total_amount', default=0)):,.2f}

Thank you for choosing SRI NIRVANA PLAZA.

We look forward to welcoming you."""


def booking_confirmation_email_body(booking: dict, invoice_number: str = "") -> str:
    guest_name = _booking_value(booking, 'guest_name', 'guestName', default='Guest')
    check_in = _booking_value(booking, 'check_in')
    check_out = _booking_value(booking, 'check_out')
    room_number = _booking_value(booking, 'room_number', 'room_id')
    booking_id = booking.get('id', '')
    invoice_reference = invoice_number or booking.get('invoice_number', '')
    return f"""Hello {guest_name},

Your booking is confirmed for the dates {check_in} to {check_out}.

Booking ID: {booking_id}
Room Number: {room_number}
Invoice Number: {invoice_reference}

We look forward to welcoming you at SRI NIRVANA PLAZA."""


def payment_success_message(invoice_number: str) -> str:
    return f"""Payment Successful

Thank you.

Your payment has been received.

Booking Confirmed.

Invoice Number:
{invoice_number}"""


def payment_reminder_message(booking: dict, reminder_type: str) -> str:
    booking_id = booking.get("id", "")
    guest_name = _booking_value(booking, "guest_name", "guestName", default="Guest")
    payment_url = booking.get("payment_url") or current_app.config.get("FRONTEND_URL", "")
    if reminder_type == "payment_reminder_10m":
        return f"""Reminder

Hi {guest_name}

Your room has been reserved temporarily.

Complete your payment to confirm your booking.

Booking ID:
{booking_id}

Payment Link:
{payment_url}"""
    if reminder_type == "payment_reminder_1h":
        return f"""Reminder

Your booking payment is still pending.

Complete payment to avoid automatic cancellation.

Booking ID:
{booking_id}"""
    return f"""Final Reminder

Your booking payment is still pending.

Please complete payment immediately.

Otherwise the reservation may be released automatically.

Booking ID:
{booking_id}"""


def booking_cancelled_message(booking: dict) -> str:
    return f"""Booking Cancelled

Hello {_booking_value(booking, 'guest_name', 'guestName', default='Guest')}

Your reservation has been cancelled because payment was not completed within the allowed time.

You can make a new booking anytime.

Thank you."""


def checkin_reminder_message(booking: dict) -> str:
    return f"""Reminder

Your stay begins tomorrow.

Hotel:
SRI NIRVANA PLAZA

Check-In:
{_booking_value(booking, 'check_in')}

Room:
{_booking_value(booking, 'room_number', 'room_id')}

Please carry a valid Government ID."""


def same_day_checkin_message(booking: dict) -> str:
    return f"""Good Morning

Today is your check-in day.

We are ready to welcome you.

Room:
{_booking_value(booking, 'room_number', 'room_id')}

Check-In Time:
2:00 PM"""


def checkout_reminder_message() -> str:
    return """Reminder

Your check-out is scheduled for tomorrow.

Please contact reception if you wish to extend your stay."""


def admin_message(title: str, lines: dict) -> str:
    body = [title, ""]
    for label, value in lines.items():
        body.extend([f"{label}:", str(value), ""])
    return "\n".join(body).strip()


def notification_doc_id(dedupe_key: str) -> str:
    safe = "".join(char if char.isalnum() or char in "_-" else "_" for char in dedupe_key)
    return safe[:140]


def schedule_notification(
    booking_id: str,
    guest_id: str,
    phone_number: str,
    notification_type: str,
    scheduled_time: datetime,
    message: str,
    dedupe_key: str,
) -> dict:
    db = get_db()
    doc_id = notification_doc_id(dedupe_key)
    ref = db.collection("notifications").document(doc_id)
    existing = ref.get()
    if existing.exists and (existing.to_dict() or {}).get("status") in {"Pending", "Sent"}:
        data = existing.to_dict() or {}
        data["id"] = ref.id
        return data
    data = {
        "notificationId": doc_id,
        "bookingId": booking_id,
        "guestId": guest_id,
        "phoneNumber": phone_number,
        "notificationType": notification_type,
        "scheduledTime": scheduled_time,
        "sentTime": None,
        "status": "Pending",
        "retryCount": 0,
        "message": message,
        "dedupeKey": dedupe_key,
        "created_at": server_timestamp(),
        "updated_at": server_timestamp(),
    }
    ref.set(data)
    result = data.copy()
    result["id"] = ref.id
    return result


def schedule_booking_payment_reminders(booking: dict) -> None:
    booking_id = booking.get("id", "")
    guest_id = booking.get("user_id", "")
    phone = _booking_value(booking, "phone", default="")
    now = utc_now()
    reminder_specs = [
        ("payment_reminder_10m", now + timedelta(minutes=10)),
        ("payment_reminder_1h", now + timedelta(hours=1)),
        ("payment_reminder_24h", now + timedelta(hours=24)),
    ]
    for reminder_type, scheduled_time in reminder_specs:
        schedule_notification(
            booking_id,
            guest_id,
            phone,
            reminder_type,
            scheduled_time,
            payment_reminder_message(booking, reminder_type),
            f"{booking_id}:{reminder_type}",
        )
    expiration_hours = current_app.config.get("PAYMENT_EXPIRATION_HOURS", 24)
    schedule_notification(
        booking_id,
        guest_id,
        phone,
        "booking_cancelled",
        now + timedelta(hours=expiration_hours, minutes=5),
        booking_cancelled_message(booking),
        f"{booking_id}:booking_cancelled",
    )


def schedule_stay_reminders(booking: dict) -> None:
    booking_id = booking.get("id", "")
    guest_id = booking.get("user_id", "")
    phone = _booking_value(booking, "phone", default="")
    check_in = parse_iso_date(booking["check_in"])
    check_out = parse_iso_date(booking["check_out"])
    schedule_notification(
        booking_id,
        guest_id,
        phone,
        "checkin_24h",
        datetime.combine(check_in - timedelta(days=1), time(hour=9), tzinfo=timezone.utc),
        checkin_reminder_message(booking),
        f"{booking_id}:checkin_24h",
    )
    schedule_notification(
        booking_id,
        guest_id,
        phone,
        "checkin_same_day",
        datetime.combine(check_in, time(hour=9), tzinfo=timezone.utc),
        same_day_checkin_message(booking),
        f"{booking_id}:checkin_same_day",
    )
    schedule_notification(
        booking_id,
        guest_id,
        phone,
        "checkout_24h",
        datetime.combine(check_out - timedelta(days=1), time(hour=9), tzinfo=timezone.utc),
        checkout_reminder_message(),
        f"{booking_id}:checkout_24h",
    )


def schedule_admin_notification(notification_type: str, message: str, dedupe_key: str) -> None:
    for phone in admin_phone_numbers():
        schedule_notification("", "admin", phone, notification_type, utc_now(), message, f"admin:{phone}:{dedupe_key}")


def cancel_payment_reminders(booking_id: str) -> int:
    db = get_db()
    cancelled = 0
    for item in db.collection("notifications").where("bookingId", "==", booking_id).where("status", "==", "Pending").stream():
        data = item.to_dict() or {}
        if data.get("notificationType") in PAYMENT_REMINDER_TYPES or data.get("notificationType") == "booking_cancelled":
            item.reference.update({"status": "Cancelled", "updated_at": server_timestamp()})
            cancelled += 1
    return cancelled


def log_notification(notification: dict, delivery_status: str, provider_response: dict) -> None:
    get_db().collection("notification_logs").document().set(
        {
            "bookingId": notification.get("bookingId", ""),
            "phoneNumber": notification.get("phoneNumber", ""),
            "messageType": notification.get("notificationType", ""),
            "sentAt": server_timestamp(),
            "deliveryStatus": delivery_status,
            "providerResponse": provider_response,
            "message": notification.get("message", ""),
        }
    )


def send_notification_reference(notification_ref) -> bool:
    snapshot = notification_ref.get()
    if not snapshot.exists:
        return False
    notification = snapshot.to_dict() or {}
    if notification.get("status") != "Pending":
        return False
    booking_id = notification.get("bookingId", "")
    notification_type = notification.get("notificationType")
    booking = None
    if booking_id:
        booking_doc = get_db().collection("bookings").document(booking_id).get()
        booking = booking_doc.to_dict() or {} if booking_doc.exists else {}
        booking["id"] = booking_id
    if notification_type in PAYMENT_REMINDER_TYPES and booking and booking.get("payment_status") == "paid":
        notification_ref.update({"status": "Cancelled", "updated_at": server_timestamp()})
        return False
    if notification_type == "booking_cancelled" and booking:
        if booking.get("payment_status") == "paid":
            notification_ref.update({"status": "Cancelled", "updated_at": server_timestamp()})
            return False
        cancel_unpaid_booking(booking)
    result = send_whatsapp_message(notification.get("phoneNumber", ""), notification.get("message", ""))
    retry_count = int(notification.get("retryCount", 0))
    if result.success:
        notification_ref.update({"status": "Sent", "sentTime": server_timestamp(), "updated_at": server_timestamp()})
        log_notification(notification, result.status, result.provider_response)
        return True
    retry_count += 1
    notification_ref.update(
        {
            "retryCount": retry_count,
            "status": "Failed" if retry_count >= 3 else "Pending",
            "updated_at": server_timestamp(),
            "providerResponse": result.provider_response,
        }
    )
    log_notification(notification, "failed", result.provider_response)
    return False


def send_immediate_notification(
    booking_id: str,
    guest_id: str,
    phone_number: str,
    notification_type: str,
    message: str,
    dedupe_key: str,
) -> None:
    notification = schedule_notification(booking_id, guest_id, phone_number, notification_type, utc_now(), message, dedupe_key)
    send_notification_reference(get_db().collection("notifications").document(notification["id"]))


def cancel_unpaid_booking(booking: dict) -> None:
    db = get_db()
    booking_id = booking.get("id")
    if not booking_id:
        return
    db.collection("bookings").document(booking_id).update({"status": "cancelled", "updated_at": server_timestamp()})
    room_id = booking.get("room_id")
    if room_id:
        room_ref = db.collection("rooms").document(str(room_id))
        room_snapshot = room_ref.get()
        if room_snapshot.exists:
            room_data = room_snapshot.to_dict() or {}
            stay_dates = set(booking.get("stay_dates", []))
            booked_dates = [date for date in room_data.get("booked_dates", []) if date not in stay_dates]
            room_ref.update({"booked_dates": booked_dates, "updated_at": server_timestamp()})


def handle_payment_success(booking_id: str, invoice_number: str = "") -> dict:
    db = get_db()
    booking_ref = db.collection("bookings").document(booking_id)
    booking_doc = booking_ref.get()
    if not booking_doc.exists:
        raise ValueError("Booking not found")
    booking = booking_doc.to_dict() or {}
    booking["id"] = booking_id
    if booking.get("payment_status") == "paid" and booking.get("confirmation_sent"):
        return booking
    booking_ref.update(
        {
            "payment_status": "paid",
            "status": "confirmed",
            "invoice_number": invoice_number or booking.get("invoice_number", ""),
            "confirmation_sent": True,
            "updated_at": server_timestamp(),
        }
    )
    booking.update({"payment_status": "paid", "status": "confirmed", "invoice_number": invoice_number or booking.get("invoice_number", "")})
    cancel_payment_reminders(booking_id)
    schedule_stay_reminders(booking)
    return booking
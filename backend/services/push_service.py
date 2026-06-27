"""
Firebase Cloud Messaging (FCM) Push Notification Service.
Uses firebase-admin SDK (already installed).
"""
import os
from datetime import datetime, timezone


def _log_push(user_id: str, title: str, body: str, status: str, error: str = ""):
    try:
        from services.firestore_client import get_db, server_timestamp
        db = get_db()
        ref = db.collection("notification_logs").document()
        ref.set({
            "logId":      ref.id,
            "channel":    "push",
            "userId":     user_id,
            "title":      title,
            "body":       body[:500],
            "status":     status,
            "error":      error,
            "sentAt":     datetime.now(timezone.utc),
            "created_at": server_timestamp(),
        })
    except Exception as exc:
        print(f"[PUSH] Log error: {exc}")


def send_push(user_id: str, title: str, body: str, data: dict = None) -> bool:
    """
    Send a push notification to a user via FCM.
    Looks up the user's fcm_token from Firestore.
    Returns True on success, False on failure.
    """
    if not user_id:
        return False

    try:
        from services.firestore_client import get_db
        db = get_db()
        user_doc = db.collection("users").document(str(user_id)).get()
        if not user_doc.exists:
            return False
        user_data = user_doc.to_dict() or {}
        fcm_token = user_data.get("fcm_token")
        if not fcm_token:
            print(f"[PUSH] No FCM token for user {user_id}")
            return False
    except Exception as exc:
        print(f"[PUSH] Error fetching user FCM token: {exc}")
        return False

    try:
        import firebase_admin.messaging as messaging
        message = messaging.Message(
            notification=messaging.Notification(title=title, body=body),
            data={str(k): str(v) for k, v in (data or {}).items()},
            token=fcm_token,
        )
        response = messaging.send(message)
        print(f"[PUSH] Sent to user {user_id} | Response: {response}")
        _log_push(user_id, title, body, "sent")
        return True
    except Exception as exc:
        error_msg = str(exc)
        print(f"[PUSH] Failed for user {user_id}: {error_msg}")
        _log_push(user_id, title, body, "failed", error=error_msg)
        return False


def send_push_booking_confirmed(user_id: str, booking: dict, invoice_number: str) -> bool:
    return send_push(
        user_id,
        title="✅ Booking Confirmed — Sri Nirvana Plaza",
        body=f"Room {booking.get('room_number')} confirmed! Invoice: {invoice_number}. Check-In: {booking.get('check_in')}.",
        data={"type": "booking_confirmed", "bookingId": booking.get("id", ""), "invoiceNumber": invoice_number},
    )


def send_push_payment_reminder(user_id: str, booking: dict) -> bool:
    return send_push(
        user_id,
        title="⏰ Payment Reminder — Sri Nirvana Plaza",
        body=f"Room {booking.get('room_number')} is reserved but payment is pending. Amount: ₹{booking.get('total_amount', 0):,.0f}",
        data={"type": "payment_reminder", "bookingId": booking.get("id", "")},
    )


def send_push_checkin_reminder(user_id: str, booking: dict) -> bool:
    return send_push(
        user_id,
        title="🏨 Check-In Tomorrow — Sri Nirvana Plaza",
        body=f"Your stay begins tomorrow! Room {booking.get('room_number')}. Check-In: {booking.get('check_in')} at 12:00 PM.",
        data={"type": "checkin_reminder", "bookingId": booking.get("id", "")},
    )


def send_push_cancellation(user_id: str, booking: dict) -> bool:
    return send_push(
        user_id,
        title="❌ Booking Cancelled — Sri Nirvana Plaza",
        body=f"Booking {booking.get('id', '')} for Room {booking.get('room_number')} has been cancelled.",
        data={"type": "booking_cancelled", "bookingId": booking.get("id", "")},
    )

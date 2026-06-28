from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from services.firestore_client import get_db, server_timestamp
from services.notification_service import send_notification_reference

notifications_bp = Blueprint("notifications", __name__)


def doc_to_dict(snapshot):
    data = snapshot.to_dict() or {}
    data["id"] = snapshot.id
    return data


@notifications_bp.get("/notifications")
@jwt_required(optional=True)
def list_notifications():
    query = get_db().collection("notifications")
    status = request.args.get("status")
    notification_type = request.args.get("type")
    if status:
        query = query.where("status", "==", status)
    if notification_type:
        query = query.where("notificationType", "==", notification_type)
    rows = [doc_to_dict(item) for item in query.limit(int(request.args.get("limit", 150))).stream()]
    search = (request.args.get("search") or "").lower()
    if search:
        rows = [row for row in rows if search in str(row.get("bookingId", "")).lower() or search in str(row.get("phoneNumber", "")).lower() or search in str(row.get("message", "")).lower()]
    return jsonify({"notifications": rows})


@notifications_bp.get("/notification_logs")
@jwt_required(optional=True)
def list_notification_logs():
    query = get_db().collection("notification_logs")
    booking_id = request.args.get("bookingId")
    if booking_id:
        query = query.where("bookingId", "==", booking_id)
    return jsonify({"notification_logs": [doc_to_dict(item) for item in query.limit(int(request.args.get("limit", 150))).stream()]})


@notifications_bp.post("/notifications/<notification_id>/resend")
@jwt_required(optional=True)
def resend_notification(notification_id):
    ref = get_db().collection("notifications").document(notification_id)
    snapshot = ref.get()
    if not snapshot.exists:
        return jsonify({"message": "Notification not found"}), 404
    ref.update({"status": "Pending", "retryCount": 0, "scheduledTime": server_timestamp(), "updated_at": server_timestamp()})
    send_notification_reference(ref)
    data = ref.get().to_dict() or {}
    data["id"] = ref.id
    return jsonify({"notification": data})

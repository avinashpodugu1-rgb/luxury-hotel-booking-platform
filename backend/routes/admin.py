from functools import wraps
from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt, jwt_required
from services.firestore_client import array_union, get_db, server_timestamp
from services.notification_service import admin_message, schedule_admin_notification

admin_bp = Blueprint("admin", __name__)


def admin_required(handler):
    @wraps(handler)
    @jwt_required()
    def wrapper(*args, **kwargs):
        if get_jwt().get("role") != "admin":
            return jsonify({"message": "Admin access required"}), 403
        return handler(*args, **kwargs)
    return wrapper


@admin_bp.get("/dashboard")
@admin_required
def dashboard():
    db = get_db()
    rooms = [r.to_dict() or {} for r in db.collection("rooms").stream()]
    bookings = [b.to_dict() or {} for b in db.collection("bookings").stream()]
    complaints = [c.to_dict() or {} for c in db.collection("complaints").stream()]
    total = len(rooms)
    booked = sum(1 for r in rooms if r.get("status") == "booked")
    blocked = sum(1 for r in rooms if r.get("status") == "maintenance")
    revenue = sum(float(b.get("total_amount", 0)) for b in bookings)
    return jsonify({
        "totalRooms": total,
        "availableRooms": max(0, total - booked - blocked),
        "bookedRooms": booked,
        "blockedRooms": blocked,
        "revenue": round(revenue, 2),
        "occupancyRate": round((booked / total) * 100, 2) if total else 0,
        "newBookings": len(bookings),
        "pendingComplaints": sum(1 for c in complaints if c.get("status") != "resolved"),
    })


@admin_bp.post("/rooms")
@admin_required
def add_room():
    db = get_db()
    payload = request.get_json() or {}
    if not payload.get("roomNumber") or not payload.get("category"):
        return jsonify({"message": "roomNumber and category are required"}), 400
    ref = db.collection("rooms").document(str(payload["roomNumber"]))
    data = {
        "room_number": payload["roomNumber"],
        "room_type": payload["category"],
        "category": payload["category"],
        "title": payload.get("title") or f"{payload['category']} {payload['roomNumber']}",
        "description": payload.get("description", ""),
        "price": float(payload.get("price", 0)),
        "floor": payload.get("floor", ""),
        "capacity": int(payload.get("guests", 2)),
        "beds": int(payload.get("beds", 1)),
        "size": payload.get("size", ""),
        "status": "available",
        "images": payload.get("images", []),
        "amenities": payload.get("amenities", []),
        "booked_dates": [],
        "blocked_dates": [],
        "created_at": server_timestamp(),
        "updated_at": server_timestamp(),
    }
    ref.set(data)
    result = ref.get().to_dict() or {}
    result["id"] = ref.id
    return jsonify({"room": result}), 201


@admin_bp.put("/rooms/<room_id>")
@admin_required
def edit_room(room_id):
    db = get_db()
    ref = db.collection("rooms").document(room_id)
    if not ref.get().exists:
        return jsonify({"message": "Room not found"}), 404
    payload = request.get_json() or {}
    updates = {"updated_at": server_timestamp()}
    for field in ["category", "title", "description", "status", "size", "floor"]:
        if field in payload:
            updates[field] = payload[field]
    if "price" in payload:
        updates["price"] = float(payload["price"])
    if "guests" in payload:
        updates["capacity"] = int(payload["guests"])
    if "images" in payload:
        updates["images"] = payload["images"]
    if "amenities" in payload:
        updates["amenities"] = payload["amenities"]
    ref.update(updates)
    result = ref.get().to_dict() or {}
    result["id"] = ref.id
    return jsonify({"room": result})


@admin_bp.delete("/rooms/<room_id>")
@admin_required
def delete_room(room_id):
    db = get_db()
    ref = db.collection("rooms").document(room_id)
    if not ref.get().exists:
        return jsonify({"message": "Room not found"}), 404
    ref.delete()
    return jsonify({"deleted": True})


@admin_bp.post("/rooms/<room_id>/block")
@admin_required
def block_room(room_id):
    db = get_db()
    ref = db.collection("rooms").document(room_id)
    if not ref.get().exists:
        return jsonify({"message": "Room not found"}), 404
    payload = request.get_json() or {}
    dates = payload.get("dates", [])
    if dates:
        ref.update({"blocked_dates": array_union(dates), "status": "maintenance", "updated_at": server_timestamp()})
        schedule_admin_notification(
            "admin_room_blocked",
            admin_message("Room Blocked", {"Room": room_id, "Dates": ", ".join(dates), "Reason": payload.get("reason", "Maintenance")}),
            f"room_blocked:{room_id}:{'-'.join(dates)}",
        )
    result = ref.get().to_dict() or {}
    result["id"] = ref.id
    return jsonify({"room": result})


@admin_bp.get("/bookings")
@admin_required
def manage_bookings():
    db = get_db()
    bookings = []
    for b in db.collection("bookings").stream():
        data = b.to_dict() or {}
        data["id"] = b.id
        bookings.append(data)
    return jsonify({"bookings": bookings})


@admin_bp.get("/users")
@admin_required
def manage_users():
    db = get_db()
    users = []
    for u in db.collection("users").stream():
        data = u.to_dict() or {}
        data.pop("password_hash", None)
        data["id"] = u.id
        users.append(data)
    return jsonify({"users": users})
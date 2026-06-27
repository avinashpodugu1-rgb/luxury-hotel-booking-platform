from functools import wraps
from datetime import datetime, timezone
from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt, jwt_required
from services.firestore_client import array_union, get_db, server_timestamp
from services.notification_service import admin_message, schedule_admin_notification
from services.automation_service import AutomationService

admin_bp = Blueprint("admin", __name__)

# â”€â”€ RBAC Decorators â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
VALID_ROLES = {"guest", "staff", "admin", "superadmin"}


def admin_required(handler):
    @wraps(handler)
    @jwt_required()
    def wrapper(*args, **kwargs):
        role = get_jwt().get("role")
        if role not in {"admin", "superadmin"}:
            return jsonify({"message": "Admin access required"}), 403
        return handler(*args, **kwargs)
    return wrapper


def staff_required(handler):
    @wraps(handler)
    @jwt_required()
    def wrapper(*args, **kwargs):
        role = get_jwt().get("role")
        if role not in {"admin", "superadmin", "staff"}:
            return jsonify({"message": "Staff or Admin access required"}), 403
        return handler(*args, **kwargs)
    return wrapper


# â”€â”€ Dashboard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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


# â”€â”€ Room Management â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
        "status_history": [],
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
    for field in ["category", "title", "description", "status", "size", "floor", "room_type"]:
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

    # Track status changes in history
    if "status" in payload:
        current = ref.get().to_dict() or {}
        history_entry = {
            "from": current.get("status"),
            "to": payload["status"],
            "changedAt": datetime.now(timezone.utc).isoformat(),
            "reason": payload.get("reason", "Admin update"),
        }
        updates["status_history"] = array_union([history_entry])

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
        # Trigger automation event for room blocked
        AutomationService.trigger_event("room_blocked", {
            "room_id": room_id,
            "start_date": min(dates),
            "end_date": max(dates),
            "reason": payload.get("reason", "Maintenance"),
        })
        schedule_admin_notification(
            "admin_room_blocked",
            admin_message("Room Blocked", {"Room": room_id, "Dates": ", ".join(dates), "Reason": payload.get("reason", "Maintenance")}),
            f"room_blocked:{room_id}:{'-'.join(dates)}",
        )
    result = ref.get().to_dict() or {}
    result["id"] = ref.id
    return jsonify({"room": result})


@admin_bp.post("/rooms/<room_id>/unblock")
@admin_required
def unblock_room(room_id):
    """Remove specific blocked dates from a room."""
    db = get_db()
    ref = db.collection("rooms").document(room_id)
    snapshot = ref.get()
    if not snapshot.exists:
        return jsonify({"message": "Room not found"}), 404
    payload = request.get_json() or {}
    dates_to_remove = set(payload.get("dates", []))
    room_data = snapshot.to_dict() or {}
    remaining_blocked = [d for d in room_data.get("blocked_dates", []) if d not in dates_to_remove]
    new_status = "available" if not remaining_blocked else "maintenance"
    ref.update({
        "blocked_dates": remaining_blocked,
        "status": new_status,
        "updated_at": server_timestamp(),
    })
    result = ref.get().to_dict() or {}
    result["id"] = ref.id
    return jsonify({"room": result})


@admin_bp.get("/rooms/<room_id>/history")
@admin_required
def get_room_history(room_id):
    """Get status change history for a room."""
    db = get_db()
    ref = db.collection("rooms").document(room_id)
    snapshot = ref.get()
    if not snapshot.exists:
        return jsonify({"message": "Room not found"}), 404
    data = snapshot.to_dict() or {}
    history = data.get("status_history", [])
    return jsonify({"roomId": room_id, "history": history})


@admin_bp.post("/rooms/bulk-status")
@admin_required
def bulk_update_room_status():
    """Update status for multiple rooms at once."""
    db = get_db()
    payload = request.get_json() or {}
    room_ids = payload.get("roomIds", [])
    new_status = payload.get("status")
    reason = payload.get("reason", "Bulk update")
    if not room_ids or not new_status:
        return jsonify({"message": "roomIds and status are required"}), 400
    updated = []
    for room_id in room_ids:
        ref = db.collection("rooms").document(room_id)
        if ref.get().exists:
            history_entry = {
                "from": (ref.get().to_dict() or {}).get("status"),
                "to": new_status,
                "changedAt": datetime.now(timezone.utc).isoformat(),
                "reason": reason,
            }
            ref.update({
                "status": new_status,
                "status_history": array_union([history_entry]),
                "updated_at": server_timestamp(),
            })
            updated.append(room_id)
    return jsonify({"updated": updated, "count": len(updated)})


@admin_bp.get("/rooms/availability-summary")
@staff_required
def rooms_availability_summary():
    """All rooms with their current availability status."""
    db = get_db()
    rooms = []
    for r in db.collection("rooms").stream():
        data = r.to_dict() or {}
        rooms.append({
            "id": r.id,
            "roomNumber": data.get("room_number", r.id),
            "roomType": data.get("room_type") or data.get("category"),
            "status": data.get("status", "available"),
            "price": data.get("price", 0),
            "capacity": data.get("capacity", 2),
            "floor": data.get("floor"),
            "bookedDatesCount": len(data.get("booked_dates", [])),
            "blockedDatesCount": len(data.get("blocked_dates", [])),
        })
    rooms.sort(key=lambda x: x["roomNumber"])
    return jsonify({"rooms": rooms, "total": len(rooms)})


# â”€â”€ Bookings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
@admin_bp.get("/bookings")
@admin_required
def manage_bookings():
    db = get_db()
    bookings = []
    for b in db.collection("bookings").stream():
        data = b.to_dict() or {}
        data["id"] = b.id
        for f in ["created_at", "updated_at", "cancelled_at"]:
            if hasattr(data.get(f), "isoformat"):
                data[f] = data[f].isoformat()
        bookings.append(data)
    return jsonify({"bookings": bookings})


# â”€â”€ Users & RBAC â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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


@admin_bp.get("/roles")
@admin_required
def list_roles():
    """List all available roles with descriptions."""
    return jsonify({
        "roles": [
            {"role": "guest",       "description": "Regular hotel guest â€” book rooms, view own bookings"},
            {"role": "staff",       "description": "Hotel staff â€” view all bookings, manage operations"},
            {"role": "admin",       "description": "Hotel admin â€” full access including room management"},
            {"role": "superadmin",  "description": "System owner â€” full access including user roles"},
        ]
    })


@admin_bp.put("/users/<user_id>/role")
@admin_required
def assign_user_role(user_id: str):
    """Assign or change a user's role."""
    db = get_db()
    ref = db.collection("users").document(user_id)
    if not ref.get().exists:
        return jsonify({"message": "User not found"}), 404
    payload = request.get_json() or {}
    new_role = payload.get("role")
    if new_role not in VALID_ROLES:
        return jsonify({"message": f"Invalid role. Valid roles: {', '.join(VALID_ROLES)}"}), 400

    # Only superadmin can assign superadmin role
    caller_role = get_jwt().get("role")
    if new_role == "superadmin" and caller_role != "superadmin":
        return jsonify({"message": "Only superadmin can assign superadmin role"}), 403

    ref.update({"role": new_role, "updated_at": server_timestamp()})
    data = ref.get().to_dict() or {}
    data.pop("password_hash", None)
    data["id"] = user_id
    return jsonify({"user": data, "message": f"Role updated to '{new_role}'"})


@admin_bp.get("/users/<user_id>")
@admin_required
def get_user_detail(user_id: str):
    """Get detailed user profile including bookings and loyalty."""
    db = get_db()
    user_doc = db.collection("users").document(user_id).get()
    if not user_doc.exists:
        return jsonify({"message": "User not found"}), 404
    data = user_doc.to_dict() or {}
    data.pop("password_hash", None)
    data["id"] = user_id

    # Booking count
    bookings = list(db.collection("bookings").where("user_id", "==", user_id).stream())
    data["totalBookings"] = len(bookings)

    # Loyalty
    loyalty_doc = db.collection("loyalty_accounts").document(user_id).get()
    data["loyaltyPoints"] = int((loyalty_doc.to_dict() or {}).get("points") or 0) if loyalty_doc.exists else 0

    for f in ["created_at", "updated_at"]:
        if hasattr(data.get(f), "isoformat"):
            data[f] = data[f].isoformat()
    return jsonify({"user": data})

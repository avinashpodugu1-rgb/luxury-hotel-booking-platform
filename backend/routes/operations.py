from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from controllers.analytics_controller import get_occupancy_summary, get_room_allocation_priorities, get_upcoming_occupancy_text
from services.date_utils import each_date_inclusive
from services.default_data import ensure_seed_rooms
from services.firestore_client import array_union, get_db, server_timestamp
from services.notification_service import admin_message, schedule_admin_notification

from services.automation_service import AutomationService

operations_bp = Blueprint("operations", __name__)

COLLECTION_FIELDS = {
    "enquiries": ["name", "phone", "email", "message", "room_type", "preferred_dates", "status", "owner", "source"],
    "corporate_bookings": ["company_name", "contact_person", "phone", "email", "room_count", "check_in", "check_out", "status", "notes"],
    "housekeeping_tasks": ["room_id", "task_type", "status", "assigned_to", "priority", "notes", "completed_at"],
    "room_service_orders": ["booking_id", "room_id", "item", "quantity", "status", "notes"],
    "complaints": ["user_id", "room_id", "category", "description", "status", "priority", "resolved_at"],
    "feedback": ["user_id", "booking_id", "rating", "comment", "category"],
    "gst_entries": ["booking_id", "invoice_number", "taxable_amount", "cgst", "sgst", "total_tax"],
    "seasonal_rates": ["room_category", "start_date", "end_date", "multiplier_or_price"],
    "loyalty_accounts": ["user_id", "points", "tier", "updated_at"],
    "shift_handover_logs": ["shift_date", "outgoing_staff", "incoming_staff", "notes"],
    "maintenance_blocks": ["room_id", "start_date", "end_date", "reason", "created_by", "status"],
}


def doc_to_dict(snapshot):
    data = snapshot.to_dict() or {}
    data["id"] = snapshot.id
    return data


def apply_filters(query):
    for key, value in request.args.items():
        if key in {"start", "end", "limit"} or value == "":
            continue
        query = query.where(key, "==", value)
    return query


@operations_bp.get("/<collection_name>")
@jwt_required(optional=True)
def list_collection(collection_name):
    if collection_name not in COLLECTION_FIELDS:
        return jsonify({"message": "Unknown collection"}), 404
    query = apply_filters(get_db().collection(collection_name))
    limit = int(request.args.get("limit", 100))
    return jsonify({collection_name: [doc_to_dict(item) for item in query.limit(limit).stream()]})


@operations_bp.post("/<collection_name>")
@jwt_required(optional=True)
def create_collection_doc(collection_name):
    if collection_name not in COLLECTION_FIELDS:
        return jsonify({"message": "Unknown collection"}), 404
    payload = request.get_json() or {}
    data = {field: payload.get(field) for field in COLLECTION_FIELDS[collection_name] if field in payload}
    data.setdefault("status", payload.get("status", "pending"))
    data["created_at"] = server_timestamp()
    ref = get_db().collection(collection_name).document()
    ref.set(data)
    
    result = ref.get().to_dict() or {}
    result["id"] = ref.id

    if collection_name == "maintenance_blocks":
        sync_maintenance_block_to_room(data)
        schedule_admin_notification(
            "admin_maintenance_created",
            admin_message("Maintenance Created", {"Room": data.get("room_id"), "Reason": data.get("reason"), "Status": data.get("status")}),
            f"maintenance_created:{ref.id}",
        )
        AutomationService.trigger_event("room_blocked", result)
    elif collection_name == "complaints":
        schedule_admin_notification(
            "admin_complaint_created",
            admin_message("Complaint Created", {"Room": data.get("room_id"), "Priority": data.get("priority"), "Complaint": data.get("description")}),
            f"complaint_created:{ref.id}",
        )
        AutomationService.trigger_event("complaint_raised", result)
    elif collection_name == "corporate_bookings":
        schedule_admin_notification(
            "admin_corporate_booking_received",
            admin_message("Corporate Booking Received", {"Company": data.get("company_name"), "Contact": data.get("contact_person"), "Rooms": data.get("room_count")}),
            f"corporate_booking:{ref.id}",
        )
        AutomationService.trigger_event("corporate_booking_created", result)
    elif collection_name == "feedback":
        AutomationService.trigger_event("guest_feedback_submitted", result)
        
    return jsonify({"document": result}), 201


@operations_bp.put("/<collection_name>/<doc_id>")
@jwt_required(optional=True)
def update_collection_doc(collection_name, doc_id):
    if collection_name not in COLLECTION_FIELDS:
        return jsonify({"message": "Unknown collection"}), 404
    payload = request.get_json() or {}
    data = {field: payload.get(field) for field in COLLECTION_FIELDS[collection_name] if field in payload}
    data["updated_at"] = server_timestamp()
    ref = get_db().collection(collection_name).document(doc_id)
    if not ref.get().exists:
        return jsonify({"message": "Document not found"}), 404
    ref.update(data)
    if collection_name == "maintenance_blocks":
        sync_maintenance_block_to_room(ref.get().to_dict() or {})
    result = ref.get().to_dict() or {}
    result["id"] = ref.id

    # Automation event triggers for updates
    if collection_name == "maintenance_blocks":
        if result.get("status") in {"completed", "Completed", "resolved", "Resolved"}:
            AutomationService.trigger_event("maintenance_completed", result)
    elif collection_name == "complaints":
        if result.get("status") in {"resolved", "Resolved"}:
            AutomationService.trigger_event("complaint_resolved", result)
    elif collection_name == "housekeeping_tasks":
        if result.get("status") in {"completed", "Completed"}:
            AutomationService.trigger_event("housekeeping_completed", {"room_id": result.get("room_id"), "taskId": result.get("id")})

    return jsonify({"document": result})


@operations_bp.get("/calendar")
def calendar():
    ensure_seed_rooms()
    start = request.args.get("start")
    end = request.args.get("end")
    if not start or not end:
        return jsonify({"message": "start and end query params are required"}), 400
    dates = each_date_inclusive(start, end)
    rooms = []
    for room in get_db().collection("rooms").stream():
        data = room.to_dict() or {}
        booked = set(data.get("booked_dates", []))
        blocked = set(data.get("blocked_dates", []))
        rooms.append(
            {
                "roomId": room.id,
                "roomNumber": data.get("room_number", room.id),
                "roomType": data.get("room_type"),
                "floor": data.get("floor"),
                "capacity": data.get("capacity"),
                "price": data.get("price"),
                "dates": [
                    {"date": date, "status": "blocked" if date in blocked else "booked" if date in booked else "available"}
                    for date in dates
                ],
            }
        )
    return jsonify({"start": start, "end": end, "rooms": sorted(rooms, key=lambda item: item["roomNumber"])})


def sync_maintenance_block_to_room(block):
    room_id = str(block.get("room_id") or "")
    if not room_id or not block.get("start_date") or not block.get("end_date"):
        return
    dates = each_date_inclusive(block["start_date"], block["end_date"])
    room_ref = get_db().collection("rooms").document(room_id)
    if block.get("status") in {"completed", "Completed", "resolved"}:
        room_ref.update({"status": "available", "updated_at": server_timestamp()})
    else:
        room_ref.update({"blocked_dates": array_union(dates), "status": "maintenance", "updated_at": server_timestamp()})


@operations_bp.get("/admin/dashboard")
@jwt_required(optional=True)
def admin_dashboard():
    rooms = [item.to_dict() or {} for item in get_db().collection("rooms").stream()]
    bookings = [item.to_dict() or {} for item in get_db().collection("bookings").stream()]
    complaints = [item.to_dict() or {} for item in get_db().collection("complaints").stream()]
    return jsonify(
        {
            "totalRooms": len(rooms),
            "bookedRooms": sum(1 for room in rooms if room.get("status") == "booked"),
            "blockedRooms": sum(1 for room in rooms if room.get("status") == "maintenance"),
            "newBookings": len(bookings),
            "pendingComplaints": sum(1 for complaint in complaints if complaint.get("status") != "resolved"),
        }
    )


@operations_bp.get("/analytics/summary")
@jwt_required(optional=True)
def analytics_summary():
    """
    Returns rule-based occupancy summary, room allocation priorities,
    and a plain-text occupancy forecast for the AI Center module.
    """
    db = get_db()
    rooms_data = [r.to_dict() or {} for r in db.collection("rooms").stream()]
    bookings_data = [b.to_dict() or {} for b in db.collection("bookings").stream()]
    return jsonify({
        "occupancy_summary": get_occupancy_summary(rooms_data, bookings_data),
        "allocation_priorities": get_room_allocation_priorities(rooms_data, bookings_data),
        "occupancy_text": get_upcoming_occupancy_text(rooms_data, bookings_data, days=7),
    })
from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from google.cloud import firestore

from services.date_utils import each_night
from services.default_data import ensure_seed_rooms
from services.firestore_client import array_union, get_db, server_timestamp
from services.notification_service import admin_message, schedule_admin_notification, schedule_booking_payment_reminders
from services.automation_service import AutomationService

bookings_bp = Blueprint("bookings", __name__)


class BookingConflict(Exception):
    pass


class OccupancyExceeded(Exception):
    pass


def booking_to_dict(snapshot):
    data = snapshot.to_dict() or {}
    data["id"] = snapshot.id
    return data


@bookings_bp.get("/bookings")
@jwt_required(optional=True)
def list_bookings():
    query = get_db().collection("bookings")
    user_id = request.args.get("userId") or (get_jwt_identity() if request.args.get("mine") == "true" else None)
    if user_id:
        query = query.where("user_id", "==", str(user_id))
    if request.args.get("roomId"):
        query = query.where("room_id", "==", str(request.args["roomId"]))
    if request.args.get("status"):
        query = query.where("status", "==", request.args["status"])
    return jsonify({"bookings": [booking_to_dict(item) for item in query.stream()]})


@bookings_bp.post("/bookings")
@jwt_required()
def create_booking():
    ensure_seed_rooms()
    payload = request.get_json() or {}
    room_id = str(payload.get("roomId") or payload.get("room_id") or payload.get("assignedRoom") or "")
    if not room_id:
        return jsonify({"message": "roomId is required"}), 400
    try:
        stay_dates = each_night(payload["checkIn"], payload["checkOut"])
    except Exception as exc:
        return jsonify({"message": str(exc)}), 400

    db = get_db()
    transaction = db.transaction()
    user_id = str(get_jwt_identity())
    submitted_guest_details = payload.get("guestDetails") or payload.get("guest_details") or []
    
    # Enforce mandatory guest fields: name, age, gender, idProofType, idNumber
    if not submitted_guest_details:
        return jsonify({"message": "Guest details are required."}), 400
    for idx, g in enumerate(submitted_guest_details):
        if not g.get("name") or not str(g.get("name")).strip():
            return jsonify({"message": f"Name is required for Guest {idx+1}."}), 400
        if not g.get("age") or not str(g.get("age")).strip():
            return jsonify({"message": f"Age is required for Guest {idx+1}."}), 400
        if not g.get("gender") or not str(g.get("gender")).strip():
            return jsonify({"message": f"Gender is required for Guest {idx+1}."}), 400
        if not g.get("idProofType") or not str(g.get("idProofType")).strip():
            return jsonify({"message": f"ID Proof Type is required for Guest {idx+1}."}), 400
        if not g.get("idNumber") or not str(g.get("idNumber")).strip():
            return jsonify({"message": f"ID Number is required for Guest {idx+1}."}), 400


    @firestore.transactional
    def reserve_room(tx):
        room_ref = db.collection("rooms").document(room_id)
        room_snapshot = room_ref.get(transaction=tx)
        if not room_snapshot.exists:
            raise ValueError("Room not found")
        room = room_snapshot.to_dict() or {}
        booked_dates = set(room.get("booked_dates", []))
        blocked_dates = set(room.get("blocked_dates", []))
        conflicts = sorted(set(stay_dates) & (booked_dates | blocked_dates))
        if conflicts:
            raise BookingConflict(", ".join(conflicts))

        max_occupancy = int(room.get("capacity") or room.get("max_occupancy") or 1)
        guest_count = len(submitted_guest_details) if submitted_guest_details else max(1, int(payload.get("guests", 1)))
        if guest_count > max_occupancy:
            raise OccupancyExceeded()

        price = float(room.get("price") or payload.get("price") or 0)
        subtotal = price * len(stay_dates)
        taxes = round(subtotal * 0.12, 2)
        service_charge = round(subtotal * 0.08, 2)
        total = round(subtotal + taxes + service_charge, 2)
        booking_ref = db.collection("bookings").document()
        booking = {
            "user_id": user_id,
            "room_id": room_id,
            "room_number": room.get("room_number", room_id),
            "room_type": room.get("room_type") or room.get("category"),
            "guest_name": payload.get("guestName"),
            "phone": payload.get("phone"),
            "email": payload.get("email"),
            "check_in": payload["checkIn"],
            "check_out": payload["checkOut"],
            "stay_dates": stay_dates,
            "guests": guest_count,
            "guest_details": submitted_guest_details[:max_occupancy],
            "max_occupancy": max_occupancy,
            "status": payload.get("status", "reserved"),
            "payment_status": payload.get("paymentStatus", "pending"),
            "payment_url": payload.get("paymentUrl"),
            "payment_method": payload.get("paymentMethod"),
            "subtotal": subtotal,
            "taxes": taxes,
            "service_charge": service_charge,
            "total_amount": total,
            "created_at": server_timestamp(),
            "updated_at": server_timestamp(),
        }
        tx.update(room_ref, {"booked_dates": array_union(stay_dates), "status": "reserved", "updated_at": server_timestamp()})
        tx.set(booking_ref, booking)
        booking["id"] = booking_ref.id
        return booking

    try:
        booking = reserve_room(transaction)
        AutomationService.trigger_event("booking_created", booking)
    except BookingConflict as exc:
        return jsonify({"message": "These dates are no longer available.", "conflicts": str(exc).split(", ")}), 409
    except OccupancyExceeded:
        return jsonify({"message": "Booking failed. Guest count exceeds the room's maximum occupancy."}), 400
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 404
    return jsonify({"booking": booking}), 201


@bookings_bp.put("/bookings/<booking_id>")
@jwt_required(optional=True)
def update_booking(booking_id):
    db = get_db()
    ref = db.collection("bookings").document(booking_id)
    if not ref.get().exists:
        return jsonify({"message": "Booking not found"}), 404
    payload = request.get_json() or {}
    
    updates = {}
    for field in ["status", "payment_status", "notes", "guest_name", "phone", "email"]:
        if field in payload:
            updates[field] = payload[field]
            
    if updates:
        updates["updated_at"] = server_timestamp()
        ref.update(updates)
        
    booking = ref.get().to_dict() or {}
    booking["id"] = ref.id
    
    # Trigger automation events
    status = updates.get("status")
    if status:
        if status.lower() in {"cancelled", "cancelled"}:
            AutomationService.trigger_event("booking_cancelled", {"bookingId": booking_id})
        elif status.lower() in {"checked-out", "checked_out", "checked-out"}:
            AutomationService.trigger_event("checkout_completed", {"bookingId": booking_id, "room_id": booking.get("room_id")})
            
    return jsonify({"booking": booking})
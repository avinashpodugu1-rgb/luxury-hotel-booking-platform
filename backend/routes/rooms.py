from flask import Blueprint, jsonify, request

from services.date_utils import each_date_inclusive
from services.default_data import ensure_seed_rooms
from services.firestore_client import get_db

rooms_bp = Blueprint("rooms", __name__)


def room_to_dict(snapshot):
    data = snapshot.to_dict() or {}
    return {
        "id": snapshot.id,
        "roomNumber": data.get("room_number", snapshot.id),
        "category": data.get("category") or data.get("room_type"),
        "roomType": data.get("room_type") or data.get("category"),
        "floor": data.get("floor"),
        "capacity": data.get("capacity"),
        "price": data.get("price", 0),
        "status": data.get("status", "available"),
        "bookedDates": data.get("booked_dates", []),
        "blockedDates": data.get("blocked_dates", []),
        "amenities": data.get("amenities", []),
        "images": data.get("images", []),
    }


@rooms_bp.get("/room-categories")
def room_categories():
    ensure_seed_rooms()
    categories = sorted({(room.to_dict() or {}).get("room_type") for room in get_db().collection("rooms").stream()})
    return jsonify({"categories": [category for category in categories if category]})


@rooms_bp.get("/rooms")
def list_rooms():
    ensure_seed_rooms()
    category = request.args.get("category")
    query = get_db().collection("rooms")
    if category:
        query = query.where("room_type", "==", category)
    rooms = sorted([room_to_dict(room) for room in query.stream()], key=lambda item: item["roomNumber"])
    return jsonify({"rooms": rooms})


@rooms_bp.get("/rooms/<room_id>")
def room_detail(room_id):
    ensure_seed_rooms()
    room = get_db().collection("rooms").document(str(room_id)).get()
    if not room.exists:
        return jsonify({"message": "Room not found"}), 404
    return jsonify(room_to_dict(room))


@rooms_bp.get("/rooms/<room_id>/availability")
def room_availability(room_id):
    ensure_seed_rooms()
    room = get_db().collection("rooms").document(str(room_id)).get()
    if not room.exists:
        return jsonify({"message": "Room not found"}), 404
    data = room.to_dict() or {}
    dates = each_date_inclusive(request.args.get("start"), request.args.get("end")) if request.args.get("start") and request.args.get("end") else []
    booked = set(data.get("booked_dates", []))
    blocked = set(data.get("blocked_dates", []))
    return jsonify(
        {
            "roomId": room.id,
            "dates": [
                {"date": date, "status": "blocked" if date in blocked else "booked" if date in booked else "available"}
                for date in dates
            ],
        }
    )
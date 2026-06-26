from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from services.firestore_client import get_db, server_timestamp

reviews_bp = Blueprint("reviews", __name__)


@reviews_bp.get("/rooms/<room_id>/reviews")
def list_reviews(room_id):
    db = get_db()
    room = db.collection("rooms").document(room_id).get()
    if not room.exists:
        return jsonify({"message": "Room not found"}), 404
    reviews = []
    for r in db.collection("reviews").where("room_id", "==", room_id).stream():
        data = r.to_dict() or {}
        data["id"] = r.id
        reviews.append(data)
    reviews.sort(key=lambda x: str(x.get("created_at", "")), reverse=True)
    return jsonify({"reviews": reviews})


@reviews_bp.post("/rooms/<room_id>/reviews")
@jwt_required()
def create_review(room_id):
    db = get_db()
    room = db.collection("rooms").document(room_id).get()
    if not room.exists:
        return jsonify({"message": "Room not found"}), 404
    payload = request.get_json() or {}
    if not payload.get("comment"):
        return jsonify({"message": "comment is required"}), 400
    user_id = str(get_jwt_identity())
    user_doc = db.collection("users").document(user_id).get()
    user_name = (user_doc.to_dict() or {}).get("full_name", "Guest") if user_doc.exists else "Guest"
    ref = db.collection("reviews").document()
    data = {
        "user_id": user_id,
        "user_name": user_name,
        "room_id": room_id,
        "rating": max(1, min(5, int(payload.get("rating", 5)))),
        "comment": payload["comment"],
        "photo_url": payload.get("photoUrl", ""),
        "created_at": server_timestamp(),
    }
    ref.set(data)
    result = ref.get().to_dict() or {}
    result["id"] = ref.id
    return jsonify({"review": result}), 201
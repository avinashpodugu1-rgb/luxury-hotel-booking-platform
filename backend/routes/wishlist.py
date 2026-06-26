from flask import Blueprint, jsonify
from flask_jwt_extended import get_jwt_identity, jwt_required

from services.firestore_client import get_db, server_timestamp

wishlist_bp = Blueprint("wishlist", __name__)


@wishlist_bp.get("/wishlist")
@jwt_required()
def get_wishlist():
    user_id = str(get_jwt_identity())
    items = [item.to_dict() | {"id": item.id} for item in get_db().collection("wishlists").where("user_id", "==", user_id).stream()]
    return jsonify({"wishlist": items})


@wishlist_bp.post("/wishlist/<room_id>")
@jwt_required()
def toggle_wishlist(room_id):
    db = get_db()
    user_id = str(get_jwt_identity())
    doc_id = f"{user_id}_{room_id}"
    ref = db.collection("wishlists").document(doc_id)
    if ref.get().exists:
        ref.delete()
        return jsonify({"saved": False, "roomId": room_id})
    ref.set({"user_id": user_id, "room_id": room_id, "created_at": server_timestamp()})
    return jsonify({"saved": True, "roomId": room_id})
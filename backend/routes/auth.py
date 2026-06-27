from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required
from werkzeug.security import check_password_hash, generate_password_hash

from services.firestore_client import get_db, server_timestamp
from services.google_oauth import verify_google_credential

auth_bp = Blueprint("auth", __name__)


def user_to_dict(snapshot):
    data = snapshot.to_dict() or {}
    return {
        "id": snapshot.id,
        "name": data.get("full_name") or data.get("name"),
        "email": data.get("email"),
        "phone": data.get("phone"),
        "role": data.get("role", "customer"),
        "avatar": data.get("avatar_url"),
    }


def token_for(user_id, role):
    return create_access_token(identity=str(user_id), additional_claims={"role": role})


def user_by_email(email):
    matches = list(get_db().collection("users").where("email", "==", email.lower()).limit(1).stream())
    return matches[0] if matches else None


@auth_bp.post("/register")
def register():
    payload = request.get_json() or {}
    required = ["fullName", "email", "phone", "password"]
    if any(not payload.get(field) for field in required):
        return jsonify({"message": "Missing required registration fields"}), 400
    email = payload["email"].strip().lower()
    if user_by_email(email):
        return jsonify({"message": "Email already registered"}), 409

    user_ref = get_db().collection("users").document()
    user_ref.set(
        {
            "full_name": payload["fullName"].strip(),
            "email": email,
            "phone": payload.get("phone"),
            "password_hash": generate_password_hash(payload["password"]),
            "role": payload.get("role", "customer"),
            "avatar_url": payload.get("avatarUrl"),
            "created_at": server_timestamp(),
            "updated_at": server_timestamp(),
        }
    )
    user = user_ref.get()
    role = (user.to_dict() or {}).get("role", "customer")
    return jsonify({"token": token_for(user.id, role), "user": user_to_dict(user)}), 201


@auth_bp.post("/login")
def login():
    payload = request.get_json() or {}
    email = (payload.get("email") or "").strip().lower()
    user = user_by_email(email)
    if not user:
        return jsonify({"message": "Account not found. Please register first."}), 404
    data = user.to_dict() if user else None
    if not data or not check_password_hash(data.get("password_hash", ""), payload.get("password") or ""):
        return jsonify({"message": "Invalid password"}), 401
    if payload.get("role") and payload["role"] != data.get("role", "customer"):
        return jsonify({"message": "Invalid portal for this user"}), 403
    return jsonify({"token": token_for(user.id, data.get("role", "customer")), "user": user_to_dict(user)})


@auth_bp.post("/google")
def google_login():
    payload = request.get_json() or {}
    credential = payload.get("credential")
    if not credential:
        return jsonify({"message": "Google credential is required"}), 400

    try:
        profile = verify_google_credential(credential)
    except Exception as exc:
        return jsonify({"message": "Google token verification failed", "detail": str(exc)}), 401

    email = profile.get("email", "").lower()
    existing = user_by_email(email)
    if not existing:
        return jsonify({"message": "This Google account is not registered. Please register first."}), 404

    existing.reference.update(
        {"google_id": profile.get("sub"), "avatar_url": profile.get("picture"), "updated_at": server_timestamp()}
    )
    user = existing.reference.get()
    role = (user.to_dict() or {}).get("role", "customer")
    return jsonify({"token": token_for(user.id, role), "user": user_to_dict(user)})



@auth_bp.get("/profile")
@jwt_required()
def profile():
    user = get_db().collection("users").document(get_jwt_identity()).get()
    if not user.exists:
        return jsonify({"message": "User not found"}), 404
    return jsonify(user_to_dict(user))


@auth_bp.put("/profile")
@jwt_required()
def update_profile():
    payload = request.get_json() or {}
    ref = get_db().collection("users").document(get_jwt_identity())
    if not ref.get().exists:
        return jsonify({"message": "User not found"}), 404
    updates = {"updated_at": server_timestamp()}
    if "fullName" in payload:
        updates["full_name"] = payload["fullName"]
    if "phone" in payload:
        updates["phone"] = payload["phone"]
    if "avatarUrl" in payload:
        updates["avatar_url"] = payload["avatarUrl"]
    ref.update(updates)
    return jsonify({"user": user_to_dict(ref.get())})
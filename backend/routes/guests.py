"""
Guest Profile & Loyalty Points API Routes.
"""
from datetime import datetime, timezone
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from services.firestore_client import get_db, server_timestamp

guests_bp = Blueprint("guests", __name__)

# Loyalty tier thresholds
LOYALTY_TIERS = [
    {"name": "Platinum", "minPoints": 2000, "color": "#B8860B", "perks": ["Free airport transfer", "Room upgrade", "Late checkout", "Complimentary breakfast"]},
    {"name": "Gold",     "minPoints": 1000, "color": "#FFD700", "perks": ["Room upgrade on availability", "Late checkout", "10% discount"]},
    {"name": "Silver",   "minPoints": 500,  "color": "#C0C0C0", "perks": ["5% discount on next booking", "Priority check-in"]},
    {"name": "Bronze",   "minPoints": 0,    "color": "#CD7F32", "perks": ["Earn points on every stay"]},
]

POINTS_CONFIG = {
    "per_booking_confirmed": 500,
    "per_feedback":          100,
    "per_referral":          200,
    "per_rupee_spent":       0,  # optional: points per ₹ spent
}


def _get_tier(points: int) -> dict:
    for tier in LOYALTY_TIERS:
        if points >= tier["minPoints"]:
            return tier
    return LOYALTY_TIERS[-1]


def _next_tier(points: int) -> dict | None:
    tiers = sorted(LOYALTY_TIERS, key=lambda t: t["minPoints"])
    for tier in tiers:
        if tier["minPoints"] > points:
            return tier
    return None


@guests_bp.get("/guests/<user_id>/profile")
@jwt_required(optional=True)
def get_guest_profile(user_id: str):
    try:
        db = get_db()
        user_doc = db.collection("users").document(user_id).get()
        if not user_doc.exists:
            return jsonify({"message": "Guest not found"}), 404

        user = user_doc.to_dict() or {}
        user.pop("password_hash", None)
        user["id"] = user_doc.id

        # Loyalty
        loyalty_doc = db.collection("loyalty_accounts").document(user_id).get()
        loyalty = loyalty_doc.to_dict() or {} if loyalty_doc.exists else {}
        points = int(loyalty.get("points") or user.get("loyalty_points") or 0)
        tier = _get_tier(points)
        next_t = _next_tier(points)

        # Booking stats
        bookings_snap = list(db.collection("bookings").where("user_id", "==", user_id).stream())
        total_bookings = len(bookings_snap)
        total_spent = sum(float((b.to_dict() or {}).get("total_amount") or 0) for b in bookings_snap if (b.to_dict() or {}).get("payment_status") == "paid")
        total_nights = sum(len((b.to_dict() or {}).get("stay_dates") or []) for b in bookings_snap)

        # Serialize datetime fields
        for field in ["created_at", "updated_at", "last_login"]:
            val = user.get(field)
            if hasattr(val, "isoformat"):
                user[field] = val.isoformat()

        return jsonify({
            "profile": user,
            "loyalty": {
                "points": points,
                "tier": tier["name"],
                "tierColor": tier["color"],
                "perks": tier["perks"],
                "nextTier": next_t["name"] if next_t else None,
                "pointsToNextTier": (next_t["minPoints"] - points) if next_t else 0,
                "progressPercent": min(100, round((points / (next_t["minPoints"] if next_t else points or 1)) * 100)) if points > 0 else 0,
            },
            "stats": {
                "totalBookings": total_bookings,
                "totalSpent": round(total_spent, 2),
                "totalNights": total_nights,
                "avgSpendPerStay": round(total_spent / total_bookings, 2) if total_bookings else 0,
            },
        })
    except Exception as exc:
        return jsonify({"message": f"Error: {str(exc)}"}), 500


@guests_bp.put("/guests/<user_id>/profile")
@jwt_required()
def update_guest_profile(user_id: str):
    try:
        caller_id = str(get_jwt_identity())
        db = get_db()
        ref = db.collection("users").document(user_id)
        if not ref.get().exists:
            return jsonify({"message": "Guest not found"}), 404

        payload = request.get_json() or {}
        allowed = ["full_name", "phone", "email", "preferences", "address", "date_of_birth", "nationality", "id_type", "id_number"]
        updates = {k: payload[k] for k in allowed if k in payload}
        updates["updated_at"] = server_timestamp()
        ref.update(updates)

        data = ref.get().to_dict() or {}
        data.pop("password_hash", None)
        data["id"] = user_id
        return jsonify({"profile": data})
    except Exception as exc:
        return jsonify({"message": f"Error: {str(exc)}"}), 500


@guests_bp.get("/guests/<user_id>/bookings")
@jwt_required(optional=True)
def get_guest_bookings(user_id: str):
    try:
        db = get_db()
        bookings = []
        for b in db.collection("bookings").where("user_id", "==", user_id).stream():
            data = b.to_dict() or {}
            data["id"] = b.id
            for f in ["created_at", "updated_at", "payment_expiry_time"]:
                if hasattr(data.get(f), "isoformat"):
                    data[f] = data[f].isoformat()
            bookings.append(data)
        bookings.sort(key=lambda x: x.get("created_at") or "", reverse=True)
        return jsonify({"bookings": bookings, "total": len(bookings)})
    except Exception as exc:
        return jsonify({"message": f"Error: {str(exc)}"}), 500


@guests_bp.get("/guests/<user_id>/loyalty")
@jwt_required(optional=True)
def get_loyalty_account(user_id: str):
    try:
        db = get_db()
        loyalty_doc = db.collection("loyalty_accounts").document(user_id).get()
        if not loyalty_doc.exists:
            points = 0
        else:
            points = int((loyalty_doc.to_dict() or {}).get("points") or 0)

        tier = _get_tier(points)
        next_t = _next_tier(points)

        # Points history
        history_snap = list(
            db.collection("loyalty_history")
              .where("userId", "==", user_id)
              .order_by("createdAt", direction="DESCENDING")
              .limit(50)
              .stream()
        )
        history = []
        for h in history_snap:
            d = h.to_dict() or {}
            d["id"] = h.id
            if hasattr(d.get("createdAt"), "isoformat"):
                d["createdAt"] = d["createdAt"].isoformat()
            history.append(d)

        return jsonify({
            "userId": user_id,
            "points": points,
            "tier": tier["name"],
            "tierColor": tier["color"],
            "perks": tier["perks"],
            "nextTier": next_t["name"] if next_t else None,
            "pointsToNextTier": (next_t["minPoints"] - points) if next_t else 0,
            "history": history,
            "allTiers": LOYALTY_TIERS,
        })
    except Exception as exc:
        return jsonify({"message": f"Error: {str(exc)}"}), 500


@guests_bp.post("/guests/<user_id>/loyalty/award")
@jwt_required(optional=True)
def award_loyalty_points(user_id: str):
    """Award loyalty points for a specific action (booking, feedback, referral)."""
    try:
        db = get_db()
        payload = request.get_json() or {}
        reason = payload.get("reason", "manual")  # booking_confirmed | feedback | referral | manual
        booking_id = payload.get("bookingId", "")
        manual_points = int(payload.get("points") or 0)

        # Determine points to award
        points_map = {
            "booking_confirmed": POINTS_CONFIG["per_booking_confirmed"],
            "feedback":          POINTS_CONFIG["per_feedback"],
            "referral":          POINTS_CONFIG["per_referral"],
        }
        award = manual_points if reason == "manual" else points_map.get(reason, 0)
        if award <= 0:
            return jsonify({"message": "No points to award"}), 400

        # Update loyalty account
        loyalty_ref = db.collection("loyalty_accounts").document(user_id)
        loyalty_doc = loyalty_ref.get()
        current_points = int((loyalty_doc.to_dict() or {}).get("points") or 0) if loyalty_doc.exists else 0
        new_points = current_points + award
        new_tier = _get_tier(new_points)

        loyalty_ref.set({
            "user_id": user_id,
            "points": new_points,
            "tier": new_tier["name"],
            "updated_at": server_timestamp(),
        }, merge=True)

        # Add to loyalty history
        hist_ref = db.collection("loyalty_history").document()
        hist_ref.set({
            "historyId":  hist_ref.id,
            "userId":     user_id,
            "bookingId":  booking_id,
            "reason":     reason,
            "points":     award,
            "balance":    new_points,
            "tier":       new_tier["name"],
            "createdAt":  datetime.now(timezone.utc),
        })

        return jsonify({
            "awarded": award,
            "newBalance": new_points,
            "tier": new_tier["name"],
        }), 201
    except Exception as exc:
        return jsonify({"message": f"Error: {str(exc)}"}), 500


@guests_bp.post("/guests/<user_id>/loyalty/redeem")
@jwt_required()
def redeem_loyalty_points(user_id: str):
    """Redeem points for a discount (100 points = ₹10 discount)."""
    try:
        db = get_db()
        payload = request.get_json() or {}
        redeem_points = int(payload.get("points") or 0)
        booking_id = payload.get("bookingId", "")

        if redeem_points <= 0:
            return jsonify({"message": "Points to redeem must be positive"}), 400

        loyalty_ref = db.collection("loyalty_accounts").document(user_id)
        loyalty_doc = loyalty_ref.get()
        current_points = int((loyalty_doc.to_dict() or {}).get("points") or 0) if loyalty_doc.exists else 0

        if current_points < redeem_points:
            return jsonify({"message": f"Insufficient points. Balance: {current_points}"}), 400

        discount_amount = round(redeem_points / 10, 2)  # 100 pts = ₹10
        new_points = current_points - redeem_points
        new_tier = _get_tier(new_points)

        loyalty_ref.set({
            "user_id": user_id,
            "points": new_points,
            "tier": new_tier["name"],
            "updated_at": server_timestamp(),
        }, merge=True)

        # History record
        hist_ref = db.collection("loyalty_history").document()
        hist_ref.set({
            "historyId":      hist_ref.id,
            "userId":         user_id,
            "bookingId":      booking_id,
            "reason":         "redemption",
            "points":         -redeem_points,
            "discountAmount": discount_amount,
            "balance":        new_points,
            "tier":           new_tier["name"],
            "createdAt":      datetime.now(timezone.utc),
        })

        # Apply discount to booking if provided
        if booking_id:
            booking_ref = db.collection("bookings").document(booking_id)
            booking_snap = booking_ref.get()
            if booking_snap.exists:
                booking_data = booking_snap.to_dict() or {}
                new_total = max(0, float(booking_data.get("total_amount") or 0) - discount_amount)
                booking_ref.update({
                    "loyalty_discount": discount_amount,
                    "total_amount": round(new_total, 2),
                    "updated_at": server_timestamp(),
                })

        return jsonify({
            "redeemedPoints": redeem_points,
            "discountAmount": discount_amount,
            "newBalance": new_points,
            "tier": new_tier["name"],
        })
    except Exception as exc:
        return jsonify({"message": f"Error: {str(exc)}"}), 500


@guests_bp.post("/notifications/register-token")
@jwt_required()
def register_fcm_token():
    """Register/update FCM token for push notifications."""
    try:
        user_id = str(get_jwt_identity())
        payload = request.get_json() or {}
        token = payload.get("token")
        if not token:
            return jsonify({"message": "token is required"}), 400
        db = get_db()
        db.collection("users").document(user_id).set(
            {"fcm_token": token, "updated_at": server_timestamp()},
            merge=True
        )
        return jsonify({"success": True})
    except Exception as exc:
        return jsonify({"message": f"Error: {str(exc)}"}), 500

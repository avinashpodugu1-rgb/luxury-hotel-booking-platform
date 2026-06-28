from datetime import datetime, timezone, timedelta
from flask import Blueprint, jsonify, request

from services.firestore_client import get_db, server_timestamp
from services.gst_service import create_gst_entry
from services.invoice_service import create_invoice_for_booking
from services.notification_service import handle_payment_success
from services.payment_service import create_payment_order
from services.automation_service import AutomationService

payments_bp = Blueprint("payments", __name__)


@payments_bp.post("/payments/create-order")
def create_payment_order():
    payload = request.get_json() or {}
    amount = float(payload.get("total") or payload.get("amount") or 0)
    if amount <= 0:
        return jsonify({"message": "Payment amount is required"}), 400
    invoice = payload.get("invoiceId") or payload.get("invoice_number") or f"SNP-PAY-{int(amount)}"
    order = create_payment_order(amount, invoice)
    ref = get_db().collection("payments").document()
    payment = {
        "booking_id": payload.get("bookingId") or payload.get("booking_id"),
        "provider": payload.get("paymentMethod") or "UPI",
        "provider_order_id": order.get("id"),
        "invoice_number": invoice,
        "amount": amount,
        "status": "created",
        "created_at": server_timestamp(),
    }
    ref.set(payment)
    payment["id"] = ref.id
    return jsonify({"order": order, "payment": payment}), 201


@payments_bp.post("/payments/success")
def mark_payment_success():
    payload = request.get_json() or {}
    booking_id = payload.get("bookingId") or payload.get("booking_id")
    if not booking_id:
        return jsonify({"message": "bookingId is required"}), 400
    invoice_number = payload.get("invoiceId") or payload.get("invoice_number") or f"SNP-{str(booking_id)[:8].upper()}"
    booking = handle_payment_success(str(booking_id), invoice_number)
    ref = get_db().collection("payments").document()
    payment = {
        "booking_id": str(booking_id),
        "provider": payload.get("paymentMethod") or payload.get("payment_method") or "UPI",
        "invoice_number": invoice_number,
        "amount": float(payload.get("total") or booking.get("total_amount") or 0),
        "status": "paid",
        "created_at": server_timestamp(),
        "updated_at": server_timestamp(),
    }
    ref.set(payment)
    payment["id"] = ref.id

    # Trigger automation
    AutomationService.trigger_event("payment_successful", {
        "booking_id": str(booking_id),
        "invoice_number": invoice_number,
        "id": ref.id
    })
    
    # Auto-generate invoice and GST entry
    try:
        create_invoice_for_booking(str(booking_id), ref.id, invoice_number)
    except Exception as e:
        print(f"Failed to auto-generate invoice: {e}")

    invoice = {"invoiceNumber": invoice_number, "bookingId": booking_id}
    return jsonify({"payment": payment, "booking": booking, "invoice": invoice})


# ── Cancellation Policy ───────────────────────────────────────────────────────
def _calculate_refund(booking: dict) -> dict:
    """
    Cancellation policy:
    - Cancel 72h+ before check-in  → 90% refund
    - Cancel 24-72h before check-in → 50% refund
    - Cancel <24h or no-show        → 0% refund
    """
    check_in_str = booking.get("check_in") or ""
    total = float(booking.get("total_amount") or 0)
    now = datetime.now(timezone.utc)

    try:
        check_in_dt = datetime.fromisoformat(check_in_str).replace(tzinfo=timezone.utc) if check_in_str else now
    except Exception:
        check_in_dt = now

    hours_until_checkin = (check_in_dt - now).total_seconds() / 3600

    if hours_until_checkin >= 72:
        pct = 0.90
        policy = "Full refund (90%) — cancelled 72+ hours before check-in"
    elif hours_until_checkin >= 24:
        pct = 0.50
        policy = "Partial refund (50%) — cancelled 24-72 hours before check-in"
    else:
        pct = 0.00
        policy = "No refund — cancelled within 24 hours of check-in"

    refund_amount = round(total * pct, 2)
    return {
        "refundPercentage": int(pct * 100),
        "refundAmount": refund_amount,
        "totalAmount": total,
        "policy": policy,
        "hoursUntilCheckin": round(hours_until_checkin, 1),
    }


@payments_bp.get("/bookings/<booking_id>/cancellation-policy")
def get_cancellation_policy(booking_id: str):
    """Preview the refund amount before cancelling."""
    db = get_db()
    booking_doc = db.collection("bookings").document(booking_id).get()
    if not booking_doc.exists:
        return jsonify({"message": "Booking not found"}), 404
    booking = booking_doc.to_dict() or {}
    if booking.get("status") == "cancelled":
        return jsonify({"message": "Booking is already cancelled"}), 400
    refund_info = _calculate_refund(booking)
    return jsonify(refund_info)


@payments_bp.post("/bookings/<booking_id>/cancel")
def cancel_booking_with_refund(booking_id: str):
    """
    Cancel a booking and initiate refund based on cancellation policy.
    Triggers automation event for notifications and room release.
    """
    db = get_db()
    booking_doc = db.collection("bookings").document(booking_id).get()
    if not booking_doc.exists:
        return jsonify({"message": "Booking not found"}), 404

    booking = booking_doc.to_dict() or {}
    booking["id"] = booking_id

    if booking.get("status") == "cancelled":
        return jsonify({"message": "Booking is already cancelled"}), 400

    payload = request.get_json() or {}
    reason = payload.get("reason", "Cancelled by guest")

    # Calculate refund
    refund_info = _calculate_refund(booking)
    refund_amount = refund_info["refundAmount"]

    # Update booking status
    db.collection("bookings").document(booking_id).update({
        "status": "cancelled",
        "cancellation_reason": reason,
        "cancellation_policy": refund_info["policy"],
        "refund_amount": refund_amount,
        "refund_status": "pending" if refund_amount > 0 else "not_applicable",
        "cancelled_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": server_timestamp(),
    })

    # Create refund record
    refund_ref = db.collection("refunds").document()
    refund_data = {
        "refundId": refund_ref.id,
        "bookingId": booking_id,
        "guestId": booking.get("user_id"),
        "originalAmount": refund_info["totalAmount"],
        "refundAmount": refund_amount,
        "refundPercentage": refund_info["refundPercentage"],
        "policy": refund_info["policy"],
        "status": "pending" if refund_amount > 0 else "not_applicable",
        "reason": reason,
        "paymentMethod": booking.get("payment_method") or "original_method",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "created_at": server_timestamp(),
    }

    # Refund will be processed manually
    refund_ref.set(refund_data)

    # Trigger cancellation automation (releases room, sends notifications)
    AutomationService.trigger_event("booking_cancelled", {"bookingId": booking_id})

    return jsonify({
        "message": "Booking cancelled successfully",
        "refund": refund_data,
        "policy": refund_info["policy"],
    })


@payments_bp.get("/refunds")
def list_refunds():
    """List all refunds. Filter by bookingId or guestId."""
    db = get_db()
    query = db.collection("refunds")
    booking_id = request.args.get("bookingId")
    guest_id = request.args.get("guestId")
    if booking_id:
        query = query.where("bookingId", "==", booking_id)
    if guest_id:
        query = query.where("guestId", "==", guest_id)
    refunds = []
    for r in query.limit(50).stream():
        data = r.to_dict() or {}
        data["id"] = r.id
        refunds.append(data)
    return jsonify({"refunds": refunds})


@payments_bp.put("/refunds/<refund_id>/status")
def update_refund_status(refund_id: str):
    """Manually update refund status (admin use)."""
    db = get_db()
    ref = db.collection("refunds").document(refund_id)
    if not ref.get().exists:
        return jsonify({"message": "Refund not found"}), 404
    payload = request.get_json() or {}
    status = payload.get("status")
    if status not in ("pending", "processed", "failed", "manual_required", "not_applicable"):
        return jsonify({"message": "Invalid status"}), 400
    ref.update({"status": status, "updatedAt": datetime.now(timezone.utc).isoformat()})
    data = ref.get().to_dict() or {}
    data["id"] = refund_id
    return jsonify({"refund": data})
from flask import Blueprint, jsonify, request

from services.firestore_client import get_db, server_timestamp
from services.gst_service import create_gst_entry
from services.invoice_service import create_invoice_for_booking
from services.notification_service import handle_payment_success
from services.payment_service import create_razorpay_order
from services.automation_service import AutomationService

payments_bp = Blueprint("payments", __name__)


@payments_bp.post("/payments/create-order")
def create_payment_order():
    payload = request.get_json() or {}
    amount = float(payload.get("total") or payload.get("amount") or 0)
    if amount <= 0:
        return jsonify({"message": "Payment amount is required"}), 400
    invoice = payload.get("invoiceId") or payload.get("invoice_number") or f"SNP-PAY-{int(amount)}"
    order = create_razorpay_order(amount, invoice)
    ref = get_db().collection("payments").document()
    payment = {
        "booking_id": payload.get("bookingId") or payload.get("booking_id"),
        "provider": payload.get("paymentMethod") or "Razorpay",
        "provider_order_id": order.get("id"),
        "invoice_number": invoice,
        "amount": amount,
        "status": "created",
        "created_at": server_timestamp(),
    }
    ref.set(payment)
    payment["id"] = ref.id
    return jsonify({"order": order, "payment": payment}), 201


@payments_bp.post("/payments/verify")
def verify_payment():
    payload = request.get_json() or {}
    matches = list(get_db().collection("payments").where("provider_order_id", "==", payload.get("razorpay_order_id")).limit(1).stream())
    if not matches:
        return jsonify({"message": "Payment not found"}), 404
    ref = matches[0].reference
    data = matches[0].to_dict() or {}
    invoice_number = data.get("invoice_number") or payload.get("invoice_number") or ""
    booking_id = data.get("booking_id") or payload.get("bookingId") or payload.get("booking_id")
    ref.update({"provider_payment_id": payload.get("razorpay_payment_id"), "status": "paid", "updated_at": server_timestamp()})
    if booking_id:
        booking = handle_payment_success(str(booking_id), invoice_number)
        AutomationService.trigger_event("payment_successful", {
            "booking_id": str(booking_id),
            "invoice_number": invoice_number or f"SNP-{str(booking_id)[:8].upper()}",
            "id": ref.id
        })
    data = ref.get().to_dict() or {}
    data["id"] = ref.id
    return jsonify({"payment": data})


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
    invoice = {"invoiceNumber": invoice_number, "bookingId": booking_id}
    return jsonify({"payment": payment, "booking": booking, "invoice": invoice})
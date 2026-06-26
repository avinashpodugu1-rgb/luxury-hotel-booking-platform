from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from services.firestore_client import get_db
from services.invoice_service import create_invoice_for_booking

invoices_bp = Blueprint("invoices", __name__)


def doc_to_dict(snapshot):
    data = snapshot.to_dict() or {}
    data["id"] = snapshot.id
    return data


@invoices_bp.get("/invoices")
@jwt_required(optional=True)
def list_invoices():
    query = get_db().collection("invoice_documents")
    booking_id = request.args.get("bookingId")
    guest_id = request.args.get("guestId")
    if booking_id:
        query = query.where("bookingId", "==", booking_id)
    if guest_id:
        query = query.where("guestId", "==", guest_id)
    return jsonify({"invoices": [doc_to_dict(item) for item in query.limit(int(request.args.get("limit", 100))).stream()]})


@invoices_bp.get("/invoices/<invoice_id>")
@jwt_required(optional=True)
def get_invoice(invoice_id):
    snapshot = get_db().collection("invoice_documents").document(invoice_id).get()
    if not snapshot.exists:
        return jsonify({"message": "Invoice not found"}), 404
    return jsonify({"invoice": doc_to_dict(snapshot)})


@invoices_bp.get("/bookings/<booking_id>/invoice")
@jwt_required(optional=True)
def get_booking_invoice(booking_id):
    matches = list(get_db().collection("invoice_documents").where("bookingId", "==", booking_id).limit(1).stream())
    if not matches:
        return jsonify({"message": "Invoice not found"}), 404
    return jsonify({"invoice": doc_to_dict(matches[0])})


@invoices_bp.post("/bookings/<booking_id>/invoice")
@jwt_required(optional=True)
def create_booking_invoice(booking_id):
    payload = request.get_json() or {}
    force = request.args.get("force", "").lower() == "true"
    try:
        invoice = create_invoice_for_booking(
            booking_id,
            payload.get("paymentId", ""),
            payload.get("invoiceNumber", ""),
            force=force
        )
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400
    return jsonify({"invoice": invoice}), 201
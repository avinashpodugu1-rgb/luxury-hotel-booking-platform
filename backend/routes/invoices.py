from flask import Blueprint, jsonify, request, make_response
from flask_jwt_extended import jwt_required

from services.firestore_client import get_db
from services.invoice_service import create_invoice_for_booking
from services.pdf_service import generate_invoice_pdf

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


@invoices_bp.get("/invoices/<invoice_id>/pdf")
@jwt_required(optional=True)
def download_invoice_pdf(invoice_id):
    """Generate and return a styled PDF invoice."""
    snapshot = get_db().collection("invoice_documents").document(invoice_id).get()
    if not snapshot.exists:
        return jsonify({"message": "Invoice not found"}), 404
    invoice_data = snapshot.to_dict() or {}
    invoice_data["id"] = snapshot.id
    try:
        pdf_bytes = generate_invoice_pdf(invoice_data)
        invoice_number = invoice_data.get("invoiceNumber", invoice_id)
        response = make_response(pdf_bytes)
        response.headers["Content-Type"] = "application/pdf"
        response.headers["Content-Disposition"] = f'attachment; filename="invoice-{invoice_number}.pdf"'
        return response
    except Exception as exc:
        return jsonify({"message": f"PDF generation failed: {str(exc)}"}), 500


@invoices_bp.get("/bookings/<booking_id>/invoice")
@jwt_required(optional=True)
def get_booking_invoice(booking_id):
    matches = list(get_db().collection("invoice_documents").where("bookingId", "==", booking_id).limit(1).stream())
    if not matches:
        return jsonify({"message": "Invoice not found"}), 404
    return jsonify({"invoice": doc_to_dict(matches[0])})


@invoices_bp.get("/bookings/<booking_id>/invoice/pdf")
@jwt_required(optional=True)
def download_booking_invoice_pdf(booking_id):
    """Download PDF invoice directly by booking ID."""
    matches = list(get_db().collection("invoice_documents").where("bookingId", "==", booking_id).limit(1).stream())
    if not matches:
        return jsonify({"message": "Invoice not found for this booking"}), 404
    invoice_data = matches[0].to_dict() or {}
    invoice_data["id"] = matches[0].id
    try:
        pdf_bytes = generate_invoice_pdf(invoice_data)
        invoice_number = invoice_data.get("invoiceNumber", booking_id)
        response = make_response(pdf_bytes)
        response.headers["Content-Type"] = "application/pdf"
        response.headers["Content-Disposition"] = f'attachment; filename="invoice-{invoice_number}.pdf"'
        return response
    except Exception as exc:
        return jsonify({"message": f"PDF generation failed: {str(exc)}"}), 500


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
from datetime import datetime, timezone

from google.cloud import firestore

from services.gst_service import create_gst_entry
from services.firestore_client import get_db, server_timestamp

HOTEL_DETAILS = {
    "hotelName": "SRI NIRVANA PLAZA",
    "address": "MG Road, Bengaluru, Karnataka, India",
    "phone": "+91 98765 43210",
    "email": "reservations@nirvanaplaza.com",
    "website": "https://srinirvanaplaza.example.com",
    "gstNumber": "29ABCDE1234F1Z5",
    "panNumber": "ABCDE1234F",
}


def _next_invoice_number(transaction, db):
    year = datetime.now(timezone.utc).year
    counter_ref = db.collection("counters").document(f"invoice_{year}")
    snapshot = counter_ref.get(transaction=transaction)
    current = int((snapshot.to_dict() or {}).get("value", 0)) if snapshot.exists else 0
    next_value = current + 1
    transaction.set(counter_ref, {"value": next_value, "updated_at": server_timestamp()}, merge=True)
    return f"SNP-{year}-{next_value:06d}"


def _find_existing_invoice(db, booking_id):
    matches = list(db.collection("invoice_documents").where("bookingId", "==", booking_id).limit(1).stream())
    return matches[0] if matches else None


def create_invoice_for_booking(booking_id: str, payment_id: str = "", invoice_number: str = "", force: bool = False) -> dict:
    db = get_db()
    existing = _find_existing_invoice(db, booking_id)
    if existing and not force:
        data = existing.to_dict() or {}
        data["id"] = existing.id
        return data

    booking_doc = db.collection("bookings").document(booking_id).get()
    if not booking_doc.exists:
        raise ValueError("Booking not found")
    booking = booking_doc.to_dict() or {}
    if booking.get("payment_status") != "paid":
        raise ValueError("Invoice can only be generated after successful payment")

    room_id = str(booking.get("room_id", ""))
    room_doc = db.collection("rooms").document(room_id).get() if room_id else None
    room = room_doc.to_dict() or {} if room_doc and room_doc.exists else {}

    user_id = str(booking.get("user_id", ""))
    user_doc = db.collection("users").document(user_id).get() if user_id else None
    user = user_doc.to_dict() or {} if user_doc and user_doc.exists else {}

    payment = {}
    if payment_id:
        payment_doc = db.collection("payments").document(payment_id).get()
        payment = payment_doc.to_dict() or {} if payment_doc.exists else {}

    total_amount = float(booking.get("total_amount", 0))
    gst_entry = create_gst_entry(booking_id, invoice_number or f"SNP-{booking_id[:8].upper()}", total_amount)

    # Capture details from existing document to preserve ID and number during force regeneration
    existing_id = existing.id if existing else None
    existing_number = (existing.to_dict() or {}).get("invoiceNumber") if existing else None

    @firestore.transactional
    def write_invoice(transaction):
        existing_inside_tx = _find_existing_invoice(db, booking_id)
        if existing_inside_tx and not force:
            data = existing_inside_tx.to_dict() or {}
            data["id"] = existing_inside_tx.id
            return data
        
        final_invoice_number = existing_number or invoice_number or _next_invoice_number(transaction, db)
        invoice_ref = db.collection("invoice_documents").document(existing_id) if existing_id else db.collection("invoice_documents").document()
        invoice_url = f"/invoice/{invoice_ref.id}"
        qr_payload = {
            "bookingId": booking_id,
            "invoiceNumber": final_invoice_number,
            "guestName": booking.get("guest_name") or user.get("full_name") or "Guest",
            "hotelName": HOTEL_DETAILS["hotelName"],
            "totalAmount": total_amount,
            "invoiceUrl": invoice_url,
        }
        data = {
            "invoiceId": invoice_ref.id,
            "invoiceNumber": final_invoice_number,
            "bookingId": booking_id,
            "paymentId": payment_id or (existing.to_dict() or {}).get("paymentId", ""),
            "guestId": user_id,
            "roomId": room_id,
            "totalAmount": total_amount,
            "gstAmount": gst_entry.get("total_tax", 0),
            "invoiceUrl": invoice_url,
            "pdfUrl": invoice_url,
            "qrCode": qr_payload,
            "hotel": HOTEL_DETAILS,
            "booking": booking,
            "room": room,
            "guest": user,
            "payment": payment,
            "gst": gst_entry,
            "invoiceStatus": "Issued",
            "createdAt": (existing.to_dict() or {}).get("createdAt") or server_timestamp(),
        }
        transaction.set(invoice_ref, data)
        transaction.update(db.collection("bookings").document(booking_id), {"invoice_number": final_invoice_number, "invoice_id": invoice_ref.id, "updated_at": server_timestamp()})
        data["id"] = invoice_ref.id
        return data

    return write_invoice(db.transaction())
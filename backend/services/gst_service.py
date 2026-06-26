from services.firestore_client import get_db, server_timestamp


def create_gst_entry(booking_id: str, invoice_number: str, total_amount: float) -> dict:
    """
    Auto-generates a GST entry for a confirmed booking.
    Tax breakdown: 12% GST split as CGST 6% + SGST 6%.
    If the booking document exists, uses its subtotal and taxes.
    Otherwise, falls back to calculating based on a 1.20 divisor (accounting for 12% tax + 8% service charge).
    """
    db = get_db()
    booking_doc = db.collection("bookings").document(booking_id).get()
    
    if booking_doc.exists:
        booking = booking_doc.to_dict() or {}
        taxable_amount = float(booking.get("subtotal", 0))
        total_tax = float(booking.get("taxes", 0))
        cgst = round(total_tax / 2, 2)
        sgst = round(total_tax / 2, 2)
    else:
        # Fallback math: total = subtotal * 1.20
        taxable_amount = round(total_amount / 1.20, 2)
        cgst = round(taxable_amount * 0.06, 2)
        sgst = round(taxable_amount * 0.06, 2)
        total_tax = round(cgst + sgst, 2)

    ref = db.collection("gst_entries").document()
    data = {
        "booking_id": booking_id,
        "invoice_number": invoice_number,
        "taxable_amount": taxable_amount,
        "cgst": cgst,
        "sgst": sgst,
        "total_tax": total_tax,
        "total_amount": total_amount,
        "created_at": server_timestamp(),
    }
    ref.set(data)
    result = data.copy()
    result["id"] = ref.id
    return result
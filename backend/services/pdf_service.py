"""
PDF Invoice Generation Service using ReportLab.
Generates a professionally styled hotel invoice PDF in memory.
"""
import io
from datetime import datetime, timezone

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

# ── Brand palette ──────────────────────────────────────────────────────────────
GOLD        = colors.HexColor("#B8860B")
DARK_GOLD   = colors.HexColor("#8B6914")
DARK_BG     = colors.HexColor("#1A1A2E")
LIGHT_GREY  = colors.HexColor("#F5F5F5")
MID_GREY    = colors.HexColor("#CCCCCC")
WHITE       = colors.white
BLACK       = colors.black

PAGE_W, PAGE_H = A4
LEFT_MARGIN = RIGHT_MARGIN = 18 * mm
TOP_MARGIN  = BOTTOM_MARGIN = 18 * mm


def _styles():
    base = getSampleStyleSheet()
    return {
        "hotel_name": ParagraphStyle(
            "hotel_name", fontSize=22, fontName="Helvetica-Bold",
            textColor=GOLD, alignment=TA_CENTER, spaceAfter=2
        ),
        "hotel_sub": ParagraphStyle(
            "hotel_sub", fontSize=9, fontName="Helvetica",
            textColor=WHITE, alignment=TA_CENTER, spaceAfter=2
        ),
        "invoice_title": ParagraphStyle(
            "invoice_title", fontSize=16, fontName="Helvetica-Bold",
            textColor=WHITE, alignment=TA_CENTER, spaceAfter=4
        ),
        "section_header": ParagraphStyle(
            "section_header", fontSize=10, fontName="Helvetica-Bold",
            textColor=GOLD, spaceAfter=4
        ),
        "normal": ParagraphStyle(
            "normal_p", fontSize=9, fontName="Helvetica",
            textColor=BLACK, spaceAfter=2
        ),
        "small": ParagraphStyle(
            "small_p", fontSize=8, fontName="Helvetica",
            textColor=colors.HexColor("#555555"), spaceAfter=1
        ),
        "bold": ParagraphStyle(
            "bold_p", fontSize=9, fontName="Helvetica-Bold",
            textColor=BLACK, spaceAfter=2
        ),
        "right": ParagraphStyle(
            "right_p", fontSize=9, fontName="Helvetica",
            textColor=BLACK, alignment=TA_RIGHT
        ),
        "total_label": ParagraphStyle(
            "total_label", fontSize=12, fontName="Helvetica-Bold",
            textColor=GOLD, alignment=TA_RIGHT
        ),
        "footer": ParagraphStyle(
            "footer_p", fontSize=8, fontName="Helvetica",
            textColor=colors.HexColor("#888888"), alignment=TA_CENTER
        ),
        "status_paid": ParagraphStyle(
            "status_paid", fontSize=11, fontName="Helvetica-Bold",
            textColor=colors.HexColor("#2E7D32"), alignment=TA_CENTER
        ),
    }


def _header_table(hotel: dict, invoice_data: dict, styles: dict):
    """Dark header banner with hotel name + invoice meta."""
    hotel_name = hotel.get("hotelName", "SRI NIRVANA PLAZA")
    hotel_addr = hotel.get("address", "")
    hotel_phone = hotel.get("phone", "")
    hotel_email = hotel.get("email", "")
    hotel_gst = hotel.get("gstNumber", "")

    invoice_number = invoice_data.get("invoiceNumber", "")
    invoice_date = invoice_data.get("createdAt", "")
    if hasattr(invoice_date, "strftime"):
        invoice_date = invoice_date.strftime("%d %b %Y")
    elif isinstance(invoice_date, str) and invoice_date:
        try:
            invoice_date = datetime.fromisoformat(invoice_date.replace("Z", "+00:00")).strftime("%d %b %Y")
        except Exception:
            pass

    left_col = [
        Paragraph(hotel_name, styles["hotel_name"]),
        Paragraph("Luxury Hospitality · Since 2010", styles["hotel_sub"]),
        Paragraph(hotel_addr, styles["hotel_sub"]),
        Paragraph(f"📞 {hotel_phone}  ✉ {hotel_email}", styles["hotel_sub"]),
        Paragraph(f"GST: {hotel_gst}", styles["hotel_sub"]),
    ]
    right_col = [
        Paragraph("TAX INVOICE", styles["invoice_title"]),
        Paragraph(f"<font color='#B8860B'>{invoice_number}</font>", styles["invoice_title"]),
        Paragraph(f"Date: {invoice_date}", styles["hotel_sub"]),
        Paragraph("Status:", styles["hotel_sub"]),
        Paragraph("✔ PAID", ParagraphStyle(
            "paid", fontSize=12, fontName="Helvetica-Bold",
            textColor=colors.HexColor("#4CAF50"), alignment=TA_CENTER
        )),
    ]

    tbl = Table([[left_col, right_col]], colWidths=["55%", "45%"])
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), DARK_BG),
        ("PADDING",    (0, 0), (-1, -1), 12),
        ("VALIGN",     (0, 0), (-1, -1), "MIDDLE"),
        ("LINEBELOW",  (0, 0), (-1, -1), 2, GOLD),
    ]))
    return tbl


def _guest_booking_table(booking: dict, styles: dict):
    """Two-column guest + booking details table."""
    guest_name = booking.get("guest_name") or booking.get("guestName") or "Guest"
    email = booking.get("email") or "—"
    phone = booking.get("phone") or "—"
    check_in = booking.get("check_in") or booking.get("checkIn") or "—"
    check_out = booking.get("check_out") or booking.get("checkOut") or "—"
    room_number = booking.get("room_number") or "—"
    room_type = booking.get("room_type") or "—"
    guests = booking.get("guests") or 1
    booking_id = booking.get("id") or "—"

    def kv(k, v):
        return [Paragraph(k, styles["small"]), Paragraph(str(v), styles["bold"])]

    guest_rows = [
        [Paragraph("GUEST INFORMATION", styles["section_header"]), ""],
        kv("Guest Name", guest_name),
        kv("Email", email),
        kv("Phone", phone),
    ]
    booking_rows = [
        [Paragraph("BOOKING DETAILS", styles["section_header"]), ""],
        kv("Booking ID", booking_id),
        kv("Room Number", room_number),
        kv("Room Type", room_type),
        kv("Guests", guests),
        kv("Check-In", check_in),
        kv("Check-Out", check_out),
    ]

    left_tbl  = Table(guest_rows,   colWidths=["35%", "65%"])
    right_tbl = Table(booking_rows, colWidths=["40%", "60%"])

    for t in (left_tbl, right_tbl):
        t.setStyle(TableStyle([
            ("VALIGN",   (0, 0), (-1, -1), "TOP"),
            ("PADDING",  (0, 0), (-1, -1), 3),
            ("SPAN",     (0, 0), (1, 0)),
            ("LINEBELOW",(0, 0), (1, 0), 0.5, GOLD),
        ]))

    outer = Table([[left_tbl, right_tbl]], colWidths=["48%", "52%"])
    outer.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), LIGHT_GREY),
        ("BACKGROUND", (1, 0), (1, 0), WHITE),
        ("BOX",        (0, 0), (-1, -1), 0.5, MID_GREY),
        ("LINEAFTER",  (0, 0), (0, -1), 0.5, MID_GREY),
        ("PADDING",    (0, 0), (-1, -1), 8),
        ("VALIGN",     (0, 0), (-1, -1), "TOP"),
    ]))
    return outer


def _charges_table(booking: dict, gst: dict, styles: dict):
    """Itemized charges + GST breakdown."""
    stay_dates = booking.get("stay_dates") or []
    nights = len(stay_dates) if stay_dates else 1
    room_type = booking.get("room_type") or "Room"
    price_per_night = float(booking.get("subtotal") or 0) / nights if nights else 0
    subtotal = float(booking.get("subtotal") or 0)
    taxes = float(booking.get("taxes") or 0)
    service_charge = float(booking.get("service_charge") or 0)
    total = float(booking.get("total_amount") or subtotal + taxes + service_charge)

    header = ["Description", "Nights / Qty", "Rate (₹)", "Amount (₹)"]
    rows = [header]
    rows.append([
        f"{room_type} Accommodation",
        str(nights),
        f"{price_per_night:,.2f}",
        f"{subtotal:,.2f}",
    ])
    # GST breakdown
    cgst = taxes / 2
    sgst = taxes / 2
    rows.append(["CGST @ 6%",  "—", "—", f"{cgst:,.2f}"])
    rows.append(["SGST @ 6%",  "—", "—", f"{sgst:,.2f}"])
    rows.append(["Service Charge @ 8%", "—", "—", f"{service_charge:,.2f}"])

    tbl = Table(rows, colWidths=["45%", "15%", "20%", "20%"])
    tbl.setStyle(TableStyle([
        # Header row
        ("BACKGROUND",   (0, 0), (-1, 0), DARK_BG),
        ("TEXTCOLOR",    (0, 0), (-1, 0), GOLD),
        ("FONTNAME",     (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE",     (0, 0), (-1, 0), 9),
        ("ALIGN",        (1, 0), (-1, 0), "CENTER"),
        # Data rows
        ("FONTSIZE",     (0, 1), (-1, -1), 9),
        ("FONTNAME",     (0, 1), (-1, -1), "Helvetica"),
        ("ALIGN",        (2, 1), (-1, -1), "RIGHT"),
        ("ALIGN",        (1, 1), (1, -1), "CENTER"),
        ("ROWBACKGROUNDS",(0, 1), (-1, -1), [WHITE, LIGHT_GREY]),
        ("GRID",         (0, 0), (-1, -1), 0.3, MID_GREY),
        ("PADDING",      (0, 0), (-1, -1), 7),
        ("LINEABOVE",    (0, 0), (-1, 0), 1, DARK_BG),
        ("LINEBELOW",    (0, -1), (-1, -1), 0.5, MID_GREY),
    ]))

    # Total row
    total_tbl = Table([
        ["", "TOTAL PAYABLE", f"₹ {total:,.2f}"],
    ], colWidths=["45%", "35%", "20%"])
    total_tbl.setStyle(TableStyle([
        ("BACKGROUND",  (0, 0), (-1, -1), DARK_BG),
        ("TEXTCOLOR",   (1, 0), (-1, -1), GOLD),
        ("FONTNAME",    (0, 0), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE",    (1, 0), (-1, -1), 13),
        ("ALIGN",       (1, 0), (-1, -1), "RIGHT"),
        ("PADDING",     (0, 0), (-1, -1), 10),
    ]))

    return [tbl, Spacer(1, 2), total_tbl]


def _footer(styles: dict):
    return [
        Spacer(1, 10 * mm),
        HRFlowable(width="100%", thickness=0.5, color=GOLD),
        Spacer(1, 3 * mm),
        Paragraph("Thank you for choosing SRI NIRVANA PLAZA. We look forward to welcoming you again.", styles["footer"]),
        Paragraph("For queries: reservations@nirvanaplaza.com | +91 98765 43210", styles["footer"]),
        Paragraph("This is a computer-generated invoice and does not require a signature.", styles["footer"]),
    ]


def generate_invoice_pdf(invoice_data: dict) -> bytes:
    """
    Generate a PDF invoice from invoice_data dict (as stored in Firestore).
    Returns raw PDF bytes.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=LEFT_MARGIN,
        rightMargin=RIGHT_MARGIN,
        topMargin=TOP_MARGIN,
        bottomMargin=BOTTOM_MARGIN,
        title=f"Invoice {invoice_data.get('invoiceNumber', '')} - Sri Nirvana Plaza",
        author="Sri Nirvana Plaza",
    )

    styles = _styles()
    hotel   = invoice_data.get("hotel") or {}
    booking = invoice_data.get("booking") or {}
    booking["id"] = booking.get("id") or invoice_data.get("bookingId") or ""
    gst     = invoice_data.get("gst") or {}

    story = []
    story.append(_header_table(hotel, invoice_data, styles))
    story.append(Spacer(1, 6 * mm))
    story.append(KeepTogether([_guest_booking_table(booking, styles)]))
    story.append(Spacer(1, 6 * mm))
    story.append(Paragraph("CHARGES & BILLING", styles["section_header"]))
    story.append(HRFlowable(width="100%", thickness=1, color=GOLD))
    story.append(Spacer(1, 3 * mm))
    story.extend(_charges_table(booking, gst, styles))
    story.extend(_footer(styles))

    doc.build(story)
    buffer.seek(0)
    return buffer.read()

"""
Notification stub service.
Logs all notification events to console.
In production, replace the print statements with:
  - WhatsApp Business API (Meta Cloud API) calls, or
  - SendGrid / Mailgun email API calls.
"""
import logging

logger = logging.getLogger(__name__)


def send_booking_confirmation(
    guest_email: str,
    guest_name: str,
    booking_id: str,
    check_in: str,
    check_out: str,
    room_number: str,
    total_amount: float,
    invoice_number: str = "",
) -> None:
    """
    Sends a booking confirmation to the guest.
    Stub: logs the message. Replace with real API call in production.
    """
    message = (
        f"Dear {guest_name}, your booking at SRI NIRVANA PLAZA is confirmed!\n"
        f"Room: {room_number} | Check-in: {check_in} | Check-out: {check_out}\n"
        f"Total: INR {total_amount:,.2f} | Invoice: {invoice_number} | Booking ID: {booking_id}"
    )
    logger.info("[NOTIFICATION - BOOKING CONFIRMATION] %s -> %s", guest_email, message)
    print(f"[NOTIFICATION] Booking confirmation sent to {guest_email}: {message}")


def send_checkin_reminder(
    guest_email: str,
    guest_name: str,
    check_in: str,
    room_number: str,
) -> None:
    """
    Sends a 24-hour check-in reminder to the guest.
    Stub: logs the message. Replace with real API call in production.
    """
    message = (
        f"Dear {guest_name}, your check-in at SRI NIRVANA PLAZA is tomorrow!\n"
        f"Room: {room_number} | Check-in date: {check_in}\n"
        f"Please carry a valid photo ID for self check-in."
    )
    logger.info("[NOTIFICATION - CHECKIN REMINDER] %s -> %s", guest_email, message)
    print(f"[NOTIFICATION] Check-in reminder sent to {guest_email}: {message}")


def send_complaint_escalation(
    staff_email: str,
    complaint_id: str,
    room_number: str,
    priority: str,
    description: str,
) -> None:
    """
    Notifies front desk staff of a high-priority complaint.
    Stub: logs the message. Replace with real API call in production.
    """
    message = (
        f"ESCALATION ALERT: Complaint {complaint_id} | Room {room_number} | Priority: {priority}\n"
        f"Details: {description}"
    )
    logger.info("[NOTIFICATION - COMPLAINT ESCALATION] %s -> %s", staff_email, message)
    print(f"[NOTIFICATION] Complaint escalation sent to {staff_email}: {message}")
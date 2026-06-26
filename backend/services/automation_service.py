import os
import threading
import time
from datetime import datetime, time as dt_time, timedelta, timezone
from dataclasses import dataclass
from flask import current_app
from services.firestore_client import get_db, server_timestamp
from services.invoice_service import create_invoice_for_booking
from services.whatsapp_service import send_whatsapp_message, normalize_phone_number
from services.gst_service import create_gst_entry
from services.date_utils import parse_iso_date, each_date_inclusive
from services.email_service import send_email

# Import notification messages templates
from services.notification_service import (
    booking_confirmation_message,
    booking_confirmation_email_body,
    payment_success_message,
    payment_reminder_message,
    booking_cancelled_message,
    checkin_reminder_message,
    same_day_checkin_message,
    checkout_reminder_message,
    schedule_admin_notification,
    admin_message,
    cancel_payment_reminders
)

# Configuration defaults
DEFAULT_SETTINGS = {
    "reminder_timings": [10, 60, 1440],  # in minutes
    "booking_expiry_hours": 24,
    "whatsapp_enabled": False,
    "email_enabled": True,
    "invoice_generation": True,
    "max_retries": 3,
    "business_hours_start": "08:00",
    "business_hours_end": "22:00"
}

def get_settings():
    try:
        db = get_db()
        doc = db.collection("automation_settings").document("config").get()
        if doc.exists:
            data = doc.to_dict() or {}
            settings = DEFAULT_SETTINGS.copy()
            settings.update(data)
            return settings
    except Exception as exc:
        print(f"[Automation Engine] Error loading settings: {exc}")
    return DEFAULT_SETTINGS

def save_settings(new_settings):
    db = get_db()
    db.collection("automation_settings").document("config").set(new_settings)

class AutomationService:
    @staticmethod
    def log_automation(automation_id: str, event_name: str, booking_id: str, guest_id: str, status: str, duration_ms: int, retry_count: int = 0, error_details: str = ""):
        try:
            db = get_db()
            log_ref = db.collection("automation_logs").document()
            log_ref.set({
                "logId": log_ref.id,
                "automationId": automation_id,
                "eventName": event_name,
                "bookingId": booking_id,
                "guestId": guest_id,
                "executionTime": datetime.now(timezone.utc),
                "status": status,
                "durationMs": duration_ms,
                "retryCount": retry_count,
                "errorDetails": error_details,
                "created_at": server_timestamp()
            })
        except Exception as exc:
            print(f"[Automation Engine] Logging error: {exc}")

    @staticmethod
    def trigger_event(event_name: str, payload: dict):
        """
        Triggers a business event and processes the workflow asynchronously in the background.
        """
        db = get_db()
        try:
            # Create event record
            event_ref = db.collection("automation_events").document()
            event_ref.set({
                "eventId": event_ref.id,
                "eventName": event_name,
                "payload": payload,
                "timestamp": datetime.now(timezone.utc)
            })
            
            # Start background execution thread to keep UI completely non-blocking
            threading.Thread(
                target=AutomationService._run_workflow_safely,
                args=(event_name, payload, event_ref.id),
                daemon=True
            ).start()
        except Exception as exc:
            print(f"[Automation Engine] Trigger event error: {exc}")

    @staticmethod
    def _run_workflow_safely(event_name: str, payload: dict, event_id: str):
        start_time = time.time()
        booking_id = payload.get("bookingId") or payload.get("booking_id") or ""
        guest_id = payload.get("guestId") or payload.get("user_id") or ""
        
        try:
            AutomationService._execute_workflow(event_name, payload)
            duration = int((time.time() - start_time) * 1000)
            AutomationService.log_automation(event_id, event_name, booking_id, guest_id, "Completed", duration)
        except Exception as exc:
            duration = int((time.time() - start_time) * 1000)
            error_msg = str(exc)
            print(f"[Automation Engine] Workflow {event_name} failed: {error_msg}")
            AutomationService.log_automation(event_id, event_name, booking_id, guest_id, "Failed", duration, error_details=error_msg)
            # Notify admin immediately on critical workflow failure
            schedule_admin_notification(
                "automation_workflow_failed",
                f"Workflow {event_name} failed: {error_msg}",
                f"workflow_failed:{event_id}"
            )

    @staticmethod
    def _execute_workflow(event_name: str, payload: dict):
        db = get_db()
        settings = get_settings()

        if event_name == "booking_created":
            booking_id = payload.get("id")
            if not booking_id:
                return
            booking_doc = db.collection("bookings").document(booking_id).get()
            if not booking_doc.exists:
                return
            booking = booking_doc.to_dict() or {}
            
            # Reserve room dates is already handled by route transaction, double check room status
            room_id = booking.get("room_id")
            if room_id:
                db.collection("rooms").document(room_id).update({"status": "reserved"})
            
            # Schedule Payment Pending automations (10m, 1h, 24h reminders and expiry cancellation)
            if booking.get("payment_status") == "pending":
                expiry_hours = settings.get("booking_expiry_hours", 24)
                expiry_time = datetime.now(timezone.utc) + timedelta(hours=expiry_hours)
                
                # Update booking with expiry time
                db.collection("bookings").document(booking_id).update({
                    "payment_expiry_time": expiry_time.isoformat(),
                    "updated_at": server_timestamp()
                })
                
                # Immediate email to guest that booking is reserved / created
                if settings.get("email_enabled", True):
                    check_in = booking.get("check_in", "")
                    check_out = booking.get("check_out", "")
                    email_subject = "Booking Received - Sri Nirvana Plaza"
                    email_body = f"""Dear {booking.get('guest_name', 'Guest')},

Thank you! Your booking reservation has been received.

Booking ID: {booking_id}
Room Number: {booking.get('room_number', 'Assigned')}
Room Type: {booking.get('room_type', 'Room')}
Check-In Date: {check_in}
Check-Out Date: {check_out}

Status: {booking.get('status', 'Reserved')} (Payment: Pending)

Please complete your payment using the link below to confirm your stay:
{booking.get('payment_url') or current_app.config.get('FRONTEND_URL', 'http://localhost:5173')}

Thank you for choosing Sri Nirvana Plaza.

Warm regards,
Hotel Management
Sri Nirvana Plaza"""
                    send_email(booking.get("email", ""), email_subject, email_body)
                
                # Schedule reminders
                now = datetime.now(timezone.utc)
                reminders = settings.get("reminder_timings", [10, 60, 1440])
                phone = booking.get("phone", "")
                user_id = booking.get("user_id", "")
                
                if len(reminders) > 0:
                    AutomationService._create_scheduled_task(booking_id, user_id, phone, "payment_reminder_10m", now + timedelta(minutes=reminders[0]), {"reminder_type": "payment_reminder_10m"})
                if len(reminders) > 1:
                    AutomationService._create_scheduled_task(booking_id, user_id, phone, "payment_reminder_1h", now + timedelta(minutes=reminders[1]), {"reminder_type": "payment_reminder_1h"})
                if len(reminders) > 2:
                    AutomationService._create_scheduled_task(booking_id, user_id, phone, "payment_reminder_24h", now + timedelta(minutes=reminders[2]), {"reminder_type": "payment_reminder_24h"})
                
                # Expiry cancellation job
                AutomationService._create_scheduled_task(booking_id, user_id, phone, "auto_cancel_unpaid_booking", expiry_time, {})
                
                # Immediate admin alert
                schedule_admin_notification(
                    "admin_new_booking",
                    admin_message("New Booking Created", {"Guest": booking.get("guest_name"), "Room": booking.get("room_number"), "Booking ID": booking_id}),
                    f"admin_new_booking:{booking_id}"
                )

        elif event_name == "payment_successful":
            booking_id = payload.get("booking_id") or payload.get("bookingId")
            invoice_number = payload.get("invoice_number") or payload.get("invoiceId")
            if not booking_id:
                return
            booking_doc = db.collection("bookings").document(booking_id).get()
            if not booking_doc.exists:
                return
            booking = booking_doc.to_dict() or {}
            
            # Cancel all pending reminders and cancellation jobs
            AutomationService._cancel_pending_tasks_for_booking(booking_id)
            
            # Confirm booking & room status
            db.collection("bookings").document(booking_id).update({
                "payment_status": "paid",
                "status": "confirmed",
                "confirmation_sent": True,
                "invoice_number": invoice_number,
                "updated_at": server_timestamp()
            })
            room_id = booking.get("room_id")
            if room_id:
                db.collection("rooms").document(room_id).update({
                    "status": "booked",
                    "updated_at": server_timestamp()
                })
            
            # Generate Invoice PDF (saved in Firestore)
            invoice_doc = None
            if settings.get("invoice_generation", True):
                invoice_doc = create_invoice_for_booking(booking_id, payload.get("id", "N/A"), invoice_number)
            
            # Email confirmation after invoice generation
            if settings.get("email_enabled", True):
                recipient_email = booking.get("email") or booking.get("guest_email")
                if recipient_email:
                    invoice_number_for_email = invoice_number or booking.get("invoice_number") or (invoice_doc or {}).get("invoiceNumber", "")
                    send_email(
                        recipient_email,
                        "Booking Confirmed - Sri Nirvana Plaza",
                        booking_confirmation_email_body(booking, invoice_number_for_email),
                    )
                else:
                    print("[EMAIL AUTOMATION] No recipient email available for booking confirmation")
            
            # Admin Notification
            schedule_admin_notification(
                "admin_payment_success",
                admin_message("Payment Successful", {"Guest": booking.get("guest_name"), "Amount": booking.get("total_amount"), "Invoice": invoice_number}),
                f"admin_payment_success:{booking_id}"
            )
            
            # Schedule Stay Reminders (24h before Check-In, Check-Out)
            check_in = parse_iso_date(booking["check_in"])
            check_out = parse_iso_date(booking["check_out"])
            phone = booking.get("phone", "")
            user_id = booking.get("user_id", "")
            
            # Check-In reminder task
            checkin_time = datetime.combine(check_in - timedelta(days=1), dt_time(hour=9), tzinfo=timezone.utc)
            AutomationService._create_scheduled_task(booking_id, user_id, phone, "checkin_reminder_24h", checkin_time, {})
            
            # Check-Out reminder task
            checkout_time = datetime.combine(check_out - timedelta(days=1), dt_time(hour=9), tzinfo=timezone.utc)
            AutomationService._create_scheduled_task(booking_id, user_id, phone, "checkout_reminder_24h", checkout_time, {})

            # Guest follow-up task (24 hours after check-out)
            followup_time = datetime.combine(check_out + timedelta(days=1), dt_time(hour=11), tzinfo=timezone.utc)
            AutomationService._create_scheduled_task(booking_id, user_id, phone, "guest_followup_24h", followup_time, {})

        elif event_name == "payment_failed":
            booking_id = payload.get("bookingId") or payload.get("booking_id")
            if not booking_id:
                return
            booking_doc = db.collection("bookings").document(booking_id).get()
            if not booking_doc.exists:
                return
            booking = booking_doc.to_dict() or {}
            
            # Immediate payment failed notification to customer
            if settings.get("whatsapp_enabled", True):
                retry_url = f"{current_app.config.get('FRONTEND_URL', 'http://localhost:5173')}/checkout/{booking_id}"
                msg = f"🏨 SRI NIRVANA PLAZA\n\nHi {booking.get('guest_name')},\n\nWe noticed your payment for booking ID {booking_id} has failed. To prevent your reservation from being automatically cancelled, please retry your payment using the link below:\n\nLink: {retry_url}\n\nSupport: +91 98765 43210"
                send_whatsapp_message(booking.get("phone", ""), msg)
            
            # Admin Notification
            schedule_admin_notification(
                "admin_payment_failed",
                admin_message("Payment Failed Alert", {"Guest": booking.get("guest_name"), "Room": booking.get("room_number"), "Booking ID": booking_id}),
                f"admin_payment_failed:{booking_id}"
            )

        elif event_name == "booking_cancelled":
            booking_id = payload.get("bookingId") or payload.get("booking_id")
            if not booking_id:
                return
            booking_doc = db.collection("bookings").document(booking_id).get()
            if not booking_doc.exists:
                return
            booking = booking_doc.to_dict() or {}
            
            # Cancel all future pending tasks for this booking
            AutomationService._cancel_pending_tasks_for_booking(booking_id)
            
            # Set room status back to available and clear booked_dates
            room_id = booking.get("room_id")
            if room_id:
                room_ref = db.collection("rooms").document(room_id)
                room_snapshot = room_ref.get()
                if room_snapshot.exists:
                    room_data = room_snapshot.to_dict() or {}
                    stay_dates = set(booking.get("stay_dates", []))
                    booked_dates = [date for date in room_data.get("booked_dates", []) if date not in stay_dates]
                    room_ref.update({
                        "booked_dates": booked_dates,
                        "status": "available",
                        "updated_at": server_timestamp()
                    })
            
            # Alert admin
            schedule_admin_notification(
                "admin_booking_cancelled",
                admin_message("Booking Cancelled", {"Guest": booking.get("guest_name"), "Room": booking.get("room_number"), "Booking ID": booking_id}),
                f"admin_booking_cancelled:{booking_id}"
            )

        elif event_name == "room_blocked":
            # Admin blocked a room (usually for maintenance or VIP occupancy)
            room_id = payload.get("room_id")
            start_date = payload.get("start_date")
            end_date = payload.get("end_date")
            reason = payload.get("reason", "Maintenance")
            
            if not room_id or not start_date or not end_date:
                return
            
            # Prevent bookings and cancel any future conflicting pending bookings
            dates = each_date_inclusive(start_date, end_date)
            conflicting = db.collection("bookings").where("room_id", "==", room_id).where("status", "==", "reserved").stream()
            for booking_doc in conflicting:
                booking = booking_doc.to_dict() or {}
                booking_id = booking_doc.id
                booking_dates = set(booking.get("stay_dates", []))
                if booking_dates & set(dates):
                    # Conflicting stay: cancel it
                    db.collection("bookings").document(booking_id).update({
                        "status": "cancelled",
                        "notes": f"Cancelled automatically due to emergency room maintenance block: {reason}",
                        "updated_at": server_timestamp()
                    })
                    AutomationService.trigger_event("booking_cancelled", {"bookingId": booking_id})
            
            # Notify reception and housekeeping
            print(f"[STAFF ALERT] Room {room_id} has been blocked for {reason} from {start_date} to {end_date}. Reception/Housekeeping updated.")

        elif event_name == "maintenance_completed":
            room_id = payload.get("room_id")
            if room_id:
                db.collection("rooms").document(room_id).update({
                    "status": "available",
                    "updated_at": server_timestamp()
                })
                print(f"[RECEPTION ALERT] Maintenance complete on room {room_id}. Status updated to available.")

        elif event_name == "complaint_raised":
            complaint_id = payload.get("id")
            category = payload.get("category", "General")
            priority = payload.get("priority", "Low")
            description = payload.get("description", "")
            room_id = payload.get("room_id", "Front Desk")
            
            # Auto-assign staff based on category
            staff_mapping = {
                "Plumbing": "Plumber John",
                "Electrical": "Electrician Bob",
                "Housekeeping": "Housekeeper Clara",
                "HVAC": "AC Tech David",
                "General": "Maintenance Duty Staff"
            }
            assigned_staff = staff_mapping.get(category, "Maintenance Duty Staff")
            
            if complaint_id:
                db.collection("complaints").document(complaint_id).update({
                    "assigned_to": assigned_staff,
                    "status": "assigned",
                    "updated_at": server_timestamp()
                })
                print(f"[COMPLAINT ASSIGNED] Assigned {assigned_staff} to complaint {complaint_id} ({category})")
                
                # Notify manager immediately if priority is High
                if priority.lower() in {"high", "critical"}:
                    schedule_admin_notification(
                        "admin_high_priority_complaint",
                        admin_message("High Priority Complaint Raised", {"Room": room_id, "Priority": priority, "Complaint": description, "Assigned To": assigned_staff}),
                        f"complaint_high_priority:{complaint_id}"
                    )

        elif event_name == "complaint_resolved":
            complaint_id = payload.get("id")
            resolved_at = payload.get("resolved_at") or datetime.now(timezone.utc)
            
            # Track and log resolution duration
            if complaint_id:
                doc = db.collection("complaints").document(complaint_id).get()
                if doc.exists:
                    data = doc.to_dict() or {}
                    created_at = data.get("created_at")
                    if created_at:
                        # Calculate time delta in minutes
                        if isinstance(created_at, str):
                            created_at = parse_iso_date(created_at)
                        elif not isinstance(created_at, datetime):
                            created_at = datetime.now(timezone.utc)
                        duration = int((resolved_at - created_at).total_seconds() / 60)
                        db.collection("complaints").document(complaint_id).update({
                            "resolution_time_minutes": duration,
                            "updated_at": server_timestamp()
                        })
                        print(f"[COMPLAINT RESOLVED] Complaint {complaint_id} resolved in {duration} minutes.")

        elif event_name == "checkout_completed":
            booking_id = payload.get("bookingId") or payload.get("booking_id")
            room_id = payload.get("room_id")
            
            # Automatically create a housekeeping task
            if room_id:
                task_ref = db.collection("housekeeping_tasks").document()
                task_ref.set({
                    "taskId": task_ref.id,
                    "room_id": room_id,
                    "task_type": "Deep Clean",
                    "status": "pending",
                    "assigned_to": "Housekeeping Team A",
                    "priority": "High",
                    "notes": f"Checkout cleaning for booking {booking_id}",
                    "created_at": server_timestamp(),
                    "updated_at": server_timestamp()
                })
                # Set room status to dirty/cleaning
                db.collection("rooms").document(room_id).update({"status": "cleaning"})
                print(f"[HOUSEKEEPING AUTOMATION] Created checkout cleaning task for room {room_id}.")

        elif event_name == "housekeeping_completed":
            room_id = payload.get("room_id")
            task_id = payload.get("taskId")
            if room_id:
                db.collection("rooms").document(room_id).update({
                    "status": "available",
                    "updated_at": server_timestamp()
                })
                print(f"[RECEPTION ALERT] Room {room_id} is clean and ready for arrivals. Housekeeping task {task_id} completed.")

        elif event_name == "corporate_booking_created":
            booking_id = payload.get("id")
            company_name = payload.get("company_name", "Corporate Corp")
            
            # Create logs & alert admin
            schedule_admin_notification(
                "admin_corporate_booking",
                admin_message("Corporate Reservation Received", {"Company": company_name, "Rooms Request": payload.get("room_count"), "Booking ID": booking_id}),
                f"admin_corporate:{booking_id}"
            )

        elif event_name == "guest_feedback_submitted":
            feedback_id = payload.get("id")
            user_id = payload.get("user_id")
            rating = payload.get("rating", 5)
            
            # Update loyalty account with points automatically
            if user_id:
                loyalty_ref = db.collection("loyalty_accounts").document(str(user_id))
                loyalty_doc = loyalty_ref.get()
                current_points = 0
                if loyalty_doc.exists:
                    current_points = (loyalty_doc.to_dict() or {}).get("points", 0)
                
                # Add 100 points for feedback submission
                new_points = current_points + 100
                tier = "Silver"
                if new_points >= 1000:
                    tier = "Platinum"
                elif new_points >= 500:
                    tier = "Gold"
                
                loyalty_ref.set({
                    "user_id": user_id,
                    "points": new_points,
                    "tier": tier,
                    "updated_at": server_timestamp()
                })
                print(f"[LOYALTY SYSTEM] Awarded 100 loyalty points to user {user_id}. New balance: {new_points} ({tier})")
                
                # Send promo discount code coupon (VIP promo code) if email is enabled
                if settings.get("email_enabled", True):
                    print(f"[EMAIL AUTOMATION] Sending discount coupon code (NIRVANAVIP10) to customer for review feedback.")

    @staticmethod
    def _create_scheduled_task(booking_id: str, guest_id: str, phone_number: str, task_type: str, scheduled_time: datetime, payload: dict):
        try:
            db = get_db()
            task_ref = db.collection("scheduled_tasks").document()
            task_ref.set({
                "taskId": task_ref.id,
                "bookingId": booking_id,
                "guestId": guest_id,
                "phoneNumber": phone_number,
                "taskType": task_type,
                "scheduled_time": scheduled_time,
                "status": "Pending",
                "retry_count": 0,
                "payload": payload,
                "created_at": server_timestamp()
            })
            return task_ref.id
        except Exception as exc:
            print(f"[Automation Engine] Error creating scheduled task: {exc}")
            return None

    @staticmethod
    def _cancel_pending_tasks_for_booking(booking_id: str):
        try:
            db = get_db()
            query = db.collection("scheduled_tasks").where("bookingId", "==", booking_id).where("status", "==", "Pending")
            for doc in query.stream():
                doc.reference.update({"status": "Cancelled", "updated_at": server_timestamp()})
        except Exception as exc:
            print(f"[Automation Engine] Error cancelling pending tasks: {exc}")

    @staticmethod
    def execute_scheduled_task(task_id: str):
        db = get_db()
        task_ref = db.collection("scheduled_tasks").document(task_id)
        task_snapshot = task_ref.get()
        if not task_snapshot.exists:
            return False
            
        task_data = task_snapshot.to_dict() or {}
        if task_data.get("status") != "Pending":
            return False
            
        # Set status to running
        task_ref.update({"status": "Running", "updated_at": server_timestamp()})
        
        start_time = time.time()
        booking_id = task_data.get("bookingId", "")
        guest_id = task_data.get("guestId", "")
        task_type = task_data.get("taskType", "")
        payload = task_data.get("payload", {})
        
        try:
            # Execute actual task workflow
            AutomationService._run_task_payload(task_type, booking_id, guest_id, task_data.get("phoneNumber", ""), payload)
            
            duration = int((time.time() - start_time) * 1000)
            task_ref.update({"status": "Completed", "updated_at": server_timestamp(), "executed_at": server_timestamp()})
            AutomationService.log_automation(task_id, task_type, booking_id, guest_id, "Completed", duration)
            return True
        except Exception as exc:
            duration = int((time.time() - start_time) * 1000)
            error_msg = str(exc)
            retry_count = int(task_data.get("retry_count", 0)) + 1
            max_retries = int(get_settings().get("max_retries", 3))
            
            # Log failure
            AutomationService.log_automation(task_id, task_type, booking_id, guest_id, "Failed", duration, retry_count, error_msg)
            
            if retry_count <= max_retries:
                # Schedule retry in 5 minutes
                next_retry = datetime.now(timezone.utc) + timedelta(minutes=5)
                task_ref.update({
                    "status": "Pending",
                    "retry_count": retry_count,
                    "scheduled_time": next_retry,
                    "last_error": error_msg,
                    "updated_at": server_timestamp()
                })
                print(f"[Automation Scheduler] Task {task_id} failed. Retrying ({retry_count}/{max_retries}) at {next_retry}")
            else:
                task_ref.update({
                    "status": "Failed",
                    "last_error": error_msg,
                    "updated_at": server_timestamp()
                })
                # Alert admin on max retry failure
                schedule_admin_notification(
                    "automation_task_max_retries_failed",
                    f"Scheduled job {task_type} for booking {booking_id} failed after {max_retries} retries: {error_msg}",
                    f"task_max_failed:{task_id}"
                )
            return False

    @staticmethod
    def _run_task_payload(task_type: str, booking_id: str, guest_id: str, phone: str, payload: dict):
        db = get_db()
        settings = get_settings()
        
        # Load booking context if present
        booking = {}
        if booking_id:
            booking_doc = db.collection("bookings").document(booking_id).get()
            if booking_doc.exists:
                booking = booking_doc.to_dict() or {}
                booking["id"] = booking_id
        
        if task_type.startswith("payment_reminder_"):
            if not booking or booking.get("payment_status") == "paid":
                return # already paid
            
            # Send WhatsApp reminder - Skipped if disabled
            if settings.get("whatsapp_enabled", False):
                msg = payment_reminder_message(booking, task_type)
                send_whatsapp_message(phone, msg)
            
            # Send Email reminder
            if settings.get("email_enabled", True):
                msg = payment_reminder_message(booking, task_type)
                send_email(booking.get("email", ""), "Payment Pending Reminder - Sri Nirvana Plaza", msg)

        elif task_type == "auto_cancel_unpaid_booking":
            if not booking or booking.get("payment_status") == "paid":
                return # paid, do not cancel
                
            # Perform automatic cancellation
            db.collection("bookings").document(booking_id).update({
                "status": "cancelled",
                "notes": "Cancelled automatically due to payment window expiration.",
                "updated_at": server_timestamp()
            })
            
            # Release room dates
            room_id = booking.get("room_id")
            if room_id:
                room_ref = db.collection("rooms").document(room_id)
                room_snapshot = room_ref.get()
                if room_snapshot.exists:
                    room_data = room_snapshot.to_dict() or {}
                    stay_dates = set(booking.get("stay_dates", []))
                    booked_dates = [date for date in room_data.get("booked_dates", []) if date not in stay_dates]
                    room_ref.update({
                        "booked_dates": booked_dates,
                        "status": "available",
                        "updated_at": server_timestamp()
                    })
            
            # Send WhatsApp cancellation notice - Skipped if disabled
            if settings.get("whatsapp_enabled", False):
                msg = booking_cancelled_message(booking)
                send_whatsapp_message(phone, msg)
                
            # Send Email cancellation notice
            if settings.get("email_enabled", True):
                msg = booking_cancelled_message(booking)
                send_email(booking.get("email", ""), "Reservation Cancelled - Sri Nirvana Plaza", msg)
                
            # Alert admin
            schedule_admin_notification(
                "admin_booking_expired_cancelled",
                admin_message("Booking Expired & Cancelled", {"Guest": booking.get("guest_name"), "Room": booking.get("room_number"), "Booking ID": booking_id}),
                f"admin_expired:{booking_id}"
            )

        elif task_type == "checkin_reminder_24h":
            if not booking or booking.get("status") == "cancelled":
                return
            
            # WhatsApp - Skipped if disabled
            if settings.get("whatsapp_enabled", False):
                msg = checkin_reminder_message(booking)
                send_whatsapp_message(phone, msg)
                
            if settings.get("email_enabled", True):
                msg = checkin_reminder_message(booking)
                send_email(booking.get("email", ""), "Your Stay Begins Tomorrow - Sri Nirvana Plaza", msg)

        elif task_type == "checkout_reminder_24h":
            if not booking or booking.get("status") == "cancelled":
                return
                
            # WhatsApp - Skipped if disabled
            if settings.get("whatsapp_enabled", False):
                msg = checkout_reminder_message()
                send_whatsapp_message(phone, msg)
                
            if settings.get("email_enabled", True):
                msg = checkout_reminder_message()
                send_email(booking.get("email", ""), "Check-out Reminder - Sri Nirvana Plaza", msg)

        elif task_type == "guest_followup_24h":
            if not booking:
                return
                
            # WhatsApp - Skipped if disabled
            if settings.get("whatsapp_enabled", False):
                msg = f"🏨 SRI NIRVANA PLAZA\n\nThank you for staying with us, {booking.get('guest_name')}!\n\nWe hope you had a luxurious stay. Please share your valuable feedback and collect 100 loyalty points + a discount coupon for your next reservation:\n\nReview Link: https://srinirvanaplaza.com/feedback?booking={booking_id}"
                send_whatsapp_message(phone, msg)
                
            # Send Email followup
            if settings.get("email_enabled", True):
                msg = f"Dear {booking.get('guest_name')},\n\nThank you for staying at Sri Nirvana Plaza!\n\nWe hope you had a luxurious stay. Please share your valuable feedback and collect 100 loyalty points + a discount coupon for your next reservation:\n\nReview Link: https://srinirvanaplaza.com/feedback?booking={booking_id}"
                send_email(booking.get("email", ""), "Feedback & Rewards - Sri Nirvana Plaza", msg)

        elif task_type == "daily_operations_report":
            # Generate Daily Operations Report at 8:00 AM
            db = get_db()
            today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            
            # Arrivals today
            arrivals = list(db.collection("bookings").where("check_in", "==", today_str).where("status", "==", "confirmed").stream())
            # Departures today
            departures = list(db.collection("bookings").where("check_out", "==", today_str).where("status", "==", "confirmed").stream())
            # Pending payments
            pending = list(db.collection("bookings").where("payment_status", "==", "pending").where("status", "!=", "cancelled").stream())
            # Rooms under maintenance
            maintenance = list(db.collection("rooms").where("status", "==", "maintenance").stream())
            
            # Stats calculations
            total_rooms = len(list(db.collection("rooms").stream()))
            occupied_rooms = len(list(db.collection("rooms").where("status", "==", "booked").stream()))
            occupancy_rate = round((occupied_rooms / total_rooms * 100), 2) if total_rooms > 0 else 0
            
            revenue = sum(float(b.to_dict().get("total_amount", 0)) for b in db.collection("bookings").where("payment_status", "==", "paid").stream())
            
            report_lines = {
                "Report Date": today_str,
                "Arrivals Count": len(arrivals),
                "Departures Count": len(departures),
                "Pending Payments Count": len(pending),
                "Rooms in Maintenance": len(maintenance),
                "Occupancy Rate": f"{occupancy_rate}%",
                "Total Paid Revenue": f"INR {revenue:,.2f}"
            }
            
            print(f"[DAILY REPORT ENGINE] Generated Report: {report_lines}")
            
            # Send copy of daily report to Admin Alert stream
            schedule_admin_notification(
                "admin_daily_operations_report",
                admin_message("Daily Hotel Operations Summary", report_lines),
                f"daily_report:{today_str}"
            )

import os
from datetime import datetime, timezone

from apscheduler.schedulers.background import BackgroundScheduler

from services.firestore_client import get_db
from services.notification_service import send_notification_reference

scheduler = BackgroundScheduler(timezone="UTC")


def process_due_notifications(app, limit=50):
    with app.app_context():
        try:
            now = datetime.now(timezone.utc)
            query = (
                get_db()
                .collection("notifications")
                .where("status", "==", "Pending")
                .where("scheduledTime", "<=", now)
                .limit(limit)
            )
            for notification in query.stream():
                send_notification_reference(notification.reference)
        except Exception as e:
            print(f"[SCHEDULER] process_due_notifications skipped (Firebase not ready): {e}")


def process_scheduled_tasks(app):
    with app.app_context():
        try:
            from services.automation_service import AutomationService
            db = get_db()
            now = datetime.now(timezone.utc)
            query = (
                db.collection("scheduled_tasks")
                .where("status", "==", "Pending")
                .where("scheduled_time", "<=", now)
                .limit(50)
            )
            for task in query.stream():
                AutomationService.execute_scheduled_task(task.id)
        except Exception as e:
            print(f"[SCHEDULER] process_scheduled_tasks skipped (Firebase not ready): {e}")


def trigger_daily_report(app):
    with app.app_context():
        try:
            from services.automation_service import AutomationService
            today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            db = get_db()
            matches = list(db.collection("scheduled_tasks")
                           .where("taskType", "==", "daily_operations_report")
                           .where("bookingId", "==", f"DAILY-{today_str}")
                           .limit(1).stream())
            if not matches:
                task_id = AutomationService._create_scheduled_task(
                    booking_id=f"DAILY-{today_str}",
                    guest_id="SYSTEM",
                    phone_number="SYSTEM",
                    task_type="daily_operations_report",
                    scheduled_time=datetime.now(timezone.utc),
                    payload={}
                )
                if task_id:
                    AutomationService.execute_scheduled_task(task_id)
        except Exception as e:
            print(f"[SCHEDULER] trigger_daily_report skipped (Firebase not ready): {e}")


def start_notification_scheduler(app):
    if not app.config.get("NOTIFICATION_SCHEDULER_ENABLED", True):
        return
    if scheduler.running:
        return
    if app.debug and os.environ.get("WERKZEUG_RUN_MAIN") not in {"true", "1"}:
        return
    interval = app.config.get("NOTIFICATION_SCHEDULER_INTERVAL_SECONDS", 60)
    scheduler.add_job(
        process_due_notifications,
        "interval",
        seconds=interval,
        args=[app],
        id="send_due_whatsapp_notifications",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    scheduler.add_job(
        process_scheduled_tasks,
        "interval",
        seconds=10,
        args=[app],
        id="process_automation_scheduled_tasks",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    scheduler.add_job(
        trigger_daily_report,
        "cron",
        hour=8,
        minute=0,
        args=[app],
        id="daily_operations_report_job",
        replace_existing=True,
    )
    scheduler.start()
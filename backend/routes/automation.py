from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from datetime import datetime, timezone

from services.firestore_client import get_db, server_timestamp
from services.automation_service import AutomationService, get_settings, save_settings

automation_bp = Blueprint("automation", __name__)


@automation_bp.get("/automation/dashboard")
@jwt_required(optional=True)
def get_dashboard_data():
    try:
        db = get_db()
        tasks_stream = db.collection("scheduled_tasks").stream()
        tasks = []
        pending_count = 0
        completed_count = 0
        failed_count = 0
        cancelled_count = 0

        for t in tasks_stream:
            data = t.to_dict() or {}
            data["id"] = t.id
            
            # Serialize datetimes to ISO strings
            for field in ["scheduled_time", "created_at", "executed_at", "updated_at"]:
                if field in data and data[field] is not None:
                    if hasattr(data[field], "isoformat"):
                        data[field] = data[field].isoformat()
                    else:
                        data[field] = str(data[field])

            tasks.append(data)
            status = data.get("status")
            if status == "Pending":
                pending_count += 1
            elif status == "Completed":
                completed_count += 1
            elif status == "Failed":
                failed_count += 1
            elif status == "Cancelled":
                cancelled_count += 1

        # Retrieve recent logs
        logs_stream = (
            db.collection("automation_logs")
            .order_by("executionTime", direction="DESCENDING")
            .limit(100)
            .stream()
        )
        logs = []
        for l in logs_stream:
            data = l.to_dict() or {}
            data["id"] = l.id
            
            # Serialize datetimes to ISO strings
            for field in ["executionTime", "created_at"]:
                if field in data and data[field] is not None:
                    if hasattr(data[field], "isoformat"):
                        data[field] = data[field].isoformat()
                    else:
                        data[field] = str(data[field])
            logs.append(data)

        return jsonify({
            "stats": {
                "pending": pending_count,
                "completed": completed_count,
                "failed": failed_count,
                "cancelled": cancelled_count,
                "total_runs": len(logs)
            },
            "tasks": sorted(tasks, key=lambda x: x.get("scheduled_time", ""), reverse=True),
            "logs": logs
        })
    except Exception as exc:
        return jsonify({"message": f"Error loading dashboard: {str(exc)}"}), 500


@automation_bp.get("/automation/settings")
@jwt_required(optional=True)
def get_automation_settings():
    return jsonify(get_settings())


@automation_bp.post("/automation/settings")
@jwt_required(optional=True)
def update_automation_settings():
    payload = request.get_json() or {}
    save_settings(payload)
    return jsonify({"success": True, "settings": get_settings()})


@automation_bp.post("/automation/tasks/<task_id>/run")
@jwt_required(optional=True)
def run_task(task_id):
    db = get_db()
    ref = db.collection("scheduled_tasks").document(task_id)
    snapshot = ref.get()
    if not snapshot.exists:
        return jsonify({"message": "Task not found"}), 404
    
    # Set status to Pending and scheduled_time to now so it executes
    ref.update({
        "status": "Pending",
        "scheduled_time": datetime.now(timezone.utc),
        "updated_at": server_timestamp()
    })
    
    success = AutomationService.execute_scheduled_task(task_id)
    return jsonify({
        "success": success,
        "message": "Task executed successfully" if success else "Task failed during manual execution"
    })


@automation_bp.post("/automation/tasks/<task_id>/cancel")
@jwt_required(optional=True)
def cancel_task(task_id):
    db = get_db()
    ref = db.collection("scheduled_tasks").document(task_id)
    if not ref.get().exists:
        return jsonify({"message": "Task not found"}), 404
    
    ref.update({
        "status": "Cancelled",
        "updated_at": server_timestamp()
    })
    return jsonify({
        "success": True,
        "message": "Task cancelled successfully"
    })

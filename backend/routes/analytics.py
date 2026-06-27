"""
Analytics & Reporting API Routes.
Aggregates data from existing Firestore collections.
"""
from datetime import datetime, timezone, timedelta
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from services.firestore_client import get_db

analytics_bp = Blueprint("analytics", __name__)


def _serialize(data: dict) -> dict:
    """Convert Firestore datetime objects to ISO strings."""
    result = {}
    for k, v in data.items():
        if hasattr(v, "isoformat"):
            result[k] = v.isoformat()
        elif isinstance(v, dict):
            result[k] = _serialize(v)
        else:
            result[k] = v
    return result


@analytics_bp.get("/analytics/revenue")
@jwt_required(optional=True)
def revenue_analytics():
    """
    Revenue breakdown — daily totals for the last N days.
    Query params: days (default 30)
    """
    try:
        db = get_db()
        days = int(request.args.get("days", 30))
        since = datetime.now(timezone.utc) - timedelta(days=days)

        paid_bookings = [
            b.to_dict() or {} for b in
            db.collection("bookings")
              .where("payment_status", "==", "paid")
              .stream()
        ]

        # Aggregate by date
        daily = {}
        total_revenue = 0.0
        for b in paid_bookings:
            created = b.get("created_at")
            if hasattr(created, "date"):
                day = str(created.date())
            elif isinstance(created, str) and created:
                try:
                    day = created[:10]
                except Exception:
                    day = "unknown"
            else:
                day = "unknown"
            amount = float(b.get("total_amount") or 0)
            daily[day] = daily.get(day, 0) + amount
            total_revenue += amount

        # Monthly aggregation
        monthly = {}
        for b in paid_bookings:
            created = b.get("created_at")
            if hasattr(created, "strftime"):
                month = created.strftime("%Y-%m")
            elif isinstance(created, str) and len(created) >= 7:
                month = created[:7]
            else:
                month = "unknown"
            amount = float(b.get("total_amount") or 0)
            monthly[month] = monthly.get(month, 0) + amount

        # Revenue by room type
        by_room_type = {}
        for b in paid_bookings:
            rtype = b.get("room_type") or "Unknown"
            amount = float(b.get("total_amount") or 0)
            by_room_type[rtype] = by_room_type.get(rtype, 0) + amount

        return jsonify({
            "totalRevenue": round(total_revenue, 2),
            "dailyRevenue": [{"date": d, "amount": round(v, 2)} for d, v in sorted(daily.items())],
            "monthlyRevenue": [{"month": m, "amount": round(v, 2)} for m, v in sorted(monthly.items())],
            "revenueByRoomType": [{"roomType": rt, "amount": round(v, 2)} for rt, v in sorted(by_room_type.items(), key=lambda x: -x[1])],
            "periodDays": days,
        })
    except Exception as exc:
        return jsonify({"message": f"Error: {str(exc)}"}), 500


@analytics_bp.get("/analytics/occupancy")
@jwt_required(optional=True)
def occupancy_analytics():
    """Room occupancy rates and availability stats."""
    try:
        db = get_db()
        rooms = [r.to_dict() or {} for r in db.collection("rooms").stream()]
        total_rooms = len(rooms)
        if total_rooms == 0:
            return jsonify({"totalRooms": 0, "occupancyRate": 0})

        status_counts = {}
        for r in rooms:
            s = r.get("status", "available")
            status_counts[s] = status_counts.get(s, 0) + 1

        booked = status_counts.get("booked", 0)
        reserved = status_counts.get("reserved", 0)
        available = status_counts.get("available", 0)
        maintenance = status_counts.get("maintenance", 0) + status_counts.get("cleaning", 0)
        occupancy_rate = round((booked / total_rooms) * 100, 2)

        # Occupancy by room type
        by_type = {}
        for r in rooms:
            rtype = r.get("room_type") or r.get("category") or "Unknown"
            if rtype not in by_type:
                by_type[rtype] = {"total": 0, "booked": 0}
            by_type[rtype]["total"] += 1
            if r.get("status") == "booked":
                by_type[rtype]["booked"] += 1

        type_stats = []
        for rtype, counts in by_type.items():
            t = counts["total"]
            b = counts["booked"]
            type_stats.append({
                "roomType": rtype,
                "total": t,
                "booked": b,
                "occupancyRate": round((b / t) * 100, 2) if t else 0,
            })

        return jsonify({
            "totalRooms": total_rooms,
            "booked": booked,
            "reserved": reserved,
            "available": available,
            "maintenance": maintenance,
            "occupancyRate": occupancy_rate,
            "byRoomType": sorted(type_stats, key=lambda x: -x["occupancyRate"]),
            "statusBreakdown": status_counts,
        })
    except Exception as exc:
        return jsonify({"message": f"Error: {str(exc)}"}), 500


@analytics_bp.get("/analytics/bookings")
@jwt_required(optional=True)
def bookings_analytics():
    """Booking stats — by status, payment, room type, monthly trends."""
    try:
        db = get_db()
        bookings = [b.to_dict() or {} for b in db.collection("bookings").stream()]
        total = len(bookings)

        status_counts = {}
        payment_counts = {}
        by_room_type = {}
        monthly_counts = {}
        avg_stay = 0.0
        total_nights = 0

        for b in bookings:
            # Status
            s = b.get("status", "unknown")
            status_counts[s] = status_counts.get(s, 0) + 1

            # Payment
            p = b.get("payment_status", "unknown")
            payment_counts[p] = payment_counts.get(p, 0) + 1

            # Room type
            rtype = b.get("room_type") or "Unknown"
            by_room_type[rtype] = by_room_type.get(rtype, 0) + 1

            # Monthly trend
            created = b.get("created_at")
            if hasattr(created, "strftime"):
                month = created.strftime("%Y-%m")
            elif isinstance(created, str) and len(created) >= 7:
                month = created[:7]
            else:
                month = "unknown"
            monthly_counts[month] = monthly_counts.get(month, 0) + 1

            # Avg stay
            nights = len(b.get("stay_dates") or [])
            total_nights += nights

        avg_stay = round(total_nights / total, 2) if total else 0

        return jsonify({
            "totalBookings": total,
            "averageStayNights": avg_stay,
            "byStatus": [{"status": s, "count": c} for s, c in status_counts.items()],
            "byPaymentStatus": [{"status": s, "count": c} for s, c in payment_counts.items()],
            "byRoomType": [{"roomType": rt, "count": c} for rt, c in sorted(by_room_type.items(), key=lambda x: -x[1])],
            "monthlyTrend": [{"month": m, "count": c} for m, c in sorted(monthly_counts.items())],
        })
    except Exception as exc:
        return jsonify({"message": f"Error: {str(exc)}"}), 500


@analytics_bp.get("/analytics/notifications")
@jwt_required(optional=True)
def notifications_analytics():
    """Notification delivery stats by channel and status."""
    try:
        db = get_db()
        logs = [l.to_dict() or {} for l in db.collection("notification_logs").stream()]
        total = len(logs)

        by_channel = {}
        by_status = {}
        by_channel_status = {}

        for l in logs:
            ch = l.get("channel") or l.get("provider") or "unknown"
            st = l.get("status") or "unknown"
            by_channel[ch] = by_channel.get(ch, 0) + 1
            by_status[st] = by_status.get(st, 0) + 1
            key = f"{ch}:{st}"
            by_channel_status[key] = by_channel_status.get(key, 0) + 1

        channel_breakdown = []
        for ch, count in by_channel.items():
            sent = by_channel_status.get(f"{ch}:sent", 0) + by_channel_status.get(f"{ch}:dry_run", 0)
            failed = by_channel_status.get(f"{ch}:failed", 0)
            channel_breakdown.append({
                "channel": ch,
                "total": count,
                "sent": sent,
                "failed": failed,
                "successRate": round((sent / count) * 100, 1) if count else 0,
            })

        return jsonify({
            "total": total,
            "byChannel": channel_breakdown,
            "byStatus": [{"status": s, "count": c} for s, c in by_status.items()],
        })
    except Exception as exc:
        return jsonify({"message": f"Error: {str(exc)}"}), 500


@analytics_bp.get("/analytics/rooms")
@jwt_required(optional=True)
def rooms_analytics():
    """Per-room revenue and booking frequency."""
    try:
        db = get_db()
        rooms = {r.id: r.to_dict() or {} for r in db.collection("rooms").stream()}
        bookings = [b.to_dict() or {} for b in db.collection("bookings").where("payment_status", "==", "paid").stream()]

        room_stats = {rid: {"roomNumber": rd.get("room_number", rid), "roomType": rd.get("room_type", ""), "bookings": 0, "revenue": 0.0, "nightsBooked": 0} for rid, rd in rooms.items()}

        for b in bookings:
            rid = b.get("room_id")
            if rid and rid in room_stats:
                room_stats[rid]["bookings"] += 1
                room_stats[rid]["revenue"] += float(b.get("total_amount") or 0)
                room_stats[rid]["nightsBooked"] += len(b.get("stay_dates") or [])

        result = sorted(room_stats.values(), key=lambda x: -x["revenue"])
        for r in result:
            r["revenue"] = round(r["revenue"], 2)

        return jsonify({"rooms": result, "totalRooms": len(rooms)})
    except Exception as exc:
        return jsonify({"message": f"Error: {str(exc)}"}), 500


@analytics_bp.get("/analytics/summary")
@jwt_required(optional=True)
def analytics_summary():
    """Quick KPI summary for the dashboard header cards."""
    try:
        db = get_db()
        bookings = [b.to_dict() or {} for b in db.collection("bookings").stream()]
        rooms = [r.to_dict() or {} for r in db.collection("rooms").stream()]

        total_bookings = len(bookings)
        confirmed = sum(1 for b in bookings if b.get("status") == "confirmed")
        cancelled = sum(1 for b in bookings if b.get("status") == "cancelled")
        pending_payment = sum(1 for b in bookings if b.get("payment_status") == "pending" and b.get("status") != "cancelled")
        total_revenue = sum(float(b.get("total_amount") or 0) for b in bookings if b.get("payment_status") == "paid")

        total_rooms = len(rooms)
        occupied = sum(1 for r in rooms if r.get("status") == "booked")
        occupancy = round((occupied / total_rooms) * 100, 1) if total_rooms else 0

        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        arrivals_today = sum(1 for b in bookings if b.get("check_in") == today and b.get("status") == "confirmed")
        departures_today = sum(1 for b in bookings if b.get("check_out") == today and b.get("status") == "confirmed")

        return jsonify({
            "totalBookings": total_bookings,
            "confirmedBookings": confirmed,
            "cancelledBookings": cancelled,
            "pendingPayments": pending_payment,
            "totalRevenue": round(total_revenue, 2),
            "totalRooms": total_rooms,
            "occupiedRooms": occupied,
            "occupancyRate": occupancy,
            "arrivalsToday": arrivals_today,
            "departuresToday": departures_today,
        })
    except Exception as exc:
        return jsonify({"message": f"Error: {str(exc)}"}), 500

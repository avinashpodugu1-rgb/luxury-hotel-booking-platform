"""
Rule-based analytics controller for Room Availability Calendar.
Provides occupancy summaries and room allocation priority suggestions
for front desk staff and hotel managers.
"""
from datetime import date, timedelta


def occupancy_percentage(booked_rooms: int, total_rooms: int) -> float:
    if not total_rooms:
        return 0.0
    return round((booked_rooms / total_rooms) * 100, 2)


def _today_iso() -> str:
    return date.today().isoformat()


def _tomorrow_iso() -> str:
    return (date.today() + timedelta(days=1)).isoformat()


def _date_after(days: int) -> str:
    return (date.today() + timedelta(days=days)).isoformat()


def get_occupancy_summary(rooms_data: list[dict], bookings_data: list[dict]) -> dict:
    """
    Returns a summary dict with total, booked, available, blocked counts,
    occupancy percentage, and today's revenue.
    """
    total = len(rooms_data)
    booked = sum(1 for r in rooms_data if r.get("status") == "booked")
    blocked = sum(1 for r in rooms_data if r.get("status") == "maintenance")
    available = max(0, total - booked - blocked)
    today = _today_iso()
    revenue_today = sum(
        float(b.get("total_amount", 0))
        for b in bookings_data
        if b.get("check_in", "") == today or b.get("status") == "confirmed"
    )
    return {
        "total_rooms": total,
        "booked": booked,
        "available": available,
        "blocked": blocked,
        "occupancy_pct": occupancy_percentage(booked, total),
        "revenue_today": round(revenue_today, 2),
    }


def get_room_allocation_priorities(
    rooms_data: list[dict], bookings_data: list[dict]
) -> list[dict]:
    """
    Rule-based priority suggestions for front desk and housekeeping staff.
    Rules:
      1. Rooms with check-out today -> needs_cleaning (High)
      2. Rooms booked for tomorrow but still status=available -> needs_preparation (High)
      3. Rooms blocked (maintenance) for more than 3 days -> long_block_review (Medium)
      4. Rooms with no booking in next 7 days -> upsell_opportunity (Low)
    """
    today = _today_iso()
    tomorrow = _tomorrow_iso()
    next_week = _date_after(7)
    priorities: list[dict] = []

    checkouts_today = {b.get("assignedRoom") or b.get("room_number") or b.get("room_id") for b in bookings_data if b.get("check_out") == today}
    checkins_tomorrow = {b.get("assignedRoom") or b.get("room_number") or b.get("room_id") for b in bookings_data if b.get("check_in") == tomorrow}
    booked_next_week = {b.get("assignedRoom") or b.get("room_number") or b.get("room_id") for b in bookings_data if b.get("check_in", "") <= next_week and b.get("check_out", "") >= today}

    for room in rooms_data:
        rn = room.get("room_number") or room.get("id", "")
        status = room.get("status", "available")
        blocked_dates = room.get("blocked_dates", [])

        if rn in checkouts_today:
            priorities.append({"room_number": rn, "priority": "High", "action": "needs_cleaning", "reason": "Guest checks out today. Room must be cleaned and inspected before next arrival."})
            continue

        if rn in checkins_tomorrow and status == "available":
            priorities.append({"room_number": rn, "priority": "High", "action": "needs_preparation", "reason": "Guest arrives tomorrow. Verify room is ready, amenities stocked, and keycard prepared."})
            continue

        if status == "maintenance" and len(blocked_dates) > 3:
            priorities.append({"room_number": rn, "priority": "Medium", "action": "long_block_review", "reason": f"Room has been under maintenance block for {len(blocked_dates)} days. Manager review recommended."})
            continue

        if rn not in booked_next_week and status == "available":
            priorities.append({"room_number": rn, "priority": "Low", "action": "upsell_opportunity", "reason": "No bookings in next 7 days. Consider promotional rate or corporate outreach."})

    priorities.sort(key=lambda x: {"High": 0, "Medium": 1, "Low": 2}.get(x["priority"], 3))
    return priorities


def get_upcoming_occupancy_text(
    rooms_data: list[dict], bookings_data: list[dict], days: int = 7
) -> str:
    """
    Returns a plain-text occupancy summary for the next N days.
    Used by the AI Center module to display rule-based recommendations.
    """
    total = len(rooms_data)
    if not total:
        return "No room data available."

    today = _today_iso()
    end_date = _date_after(days)

    active_bookings = [b for b in bookings_data if b.get("check_in", "") <= end_date and b.get("check_out", "") >= today]
    occupied_rooms = {b.get("assignedRoom") or b.get("room_number") or b.get("room_id") for b in active_bookings}
    occupied_count = len(occupied_rooms)
    pct = occupancy_percentage(occupied_count, total)

    bookings_by_date: dict[str, int] = {}
    for b in active_bookings:
        ci = b.get("check_in", "")
        if ci:
            bookings_by_date[ci] = bookings_by_date.get(ci, 0) + 1

    peak_day = max(bookings_by_date, key=lambda d: bookings_by_date[d]) if bookings_by_date else "N/A"
    peak_count = bookings_by_date.get(peak_day, 0)

    revenue_forecast = sum(float(b.get("total_amount", 0)) for b in active_bookings)
    needs_prep = sum(1 for b in active_bookings if b.get("check_in") == (date.today() + timedelta(days=1)).isoformat())

    return (
        f"Next {days} days: {occupied_count}/{total} rooms occupied ({pct}%). "
        f"Peak day: {peak_day} with {peak_count} check-ins. "
        f"{needs_prep} room(s) need preparation for tomorrow. "
        f"Revenue forecast: INR {revenue_forecast:,.0f}."
    )
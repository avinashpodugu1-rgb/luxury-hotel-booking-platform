from services.firestore_client import get_db, server_timestamp

ROOM_SEEDS = [
    ("101", "Single", "Floor 1", 1, 7500),
    ("102", "Single", "Floor 1", 1, 8150),
    ("103", "Deluxe", "Floor 1", 2, 8800),
    ("104", "Deluxe", "Floor 1", 2, 9450),
    ("105", "Deluxe", "Floor 1", 2, 10100),
    ("201", "Executive Suite", "Floor 2", 2, 10500),
    ("202", "Executive Suite", "Floor 2", 2, 11150),
    ("203", "Executive Suite", "Floor 2", 2, 11800),
    ("204", "Executive Suite", "Floor 2", 2, 12450),
    ("205", "Executive Suite", "Floor 2", 2, 13100),
    ("301", "Double", "Floor 3", 4, 13500),
    ("302", "Double", "Floor 3", 4, 14150),
    ("303", "Double", "Floor 3", 4, 14800),
    ("304", "Double", "Floor 3", 4, 15450),
    ("305", "Double", "Floor 3", 4, 16100),
    ("401", "Suite", "Floor 4", 3, 18500),
    ("402", "Suite", "Floor 4", 3, 19150),
    ("403", "Suite", "Floor 4", 3, 19800),
    ("404", "Suite", "Floor 4", 3, 20450),
    ("405", "Suite", "Floor 4", 3, 21100),
    ("501", "Executive Suite", "Floor 5", 5, 36000),
    ("502", "Executive Suite", "Floor 5", 5, 36650),
    ("503", "Executive Suite", "Floor 5", 5, 37300),
    ("504", "Executive Suite", "Floor 5", 5, 37950),
    ("505", "Executive Suite", "Floor 5", 5, 38600),
]


def ensure_seed_rooms():
    db = get_db()
    first_room = next(db.collection("rooms").limit(1).stream(), None)
    if first_room:
        return

    batch = db.batch()
    for room_number, room_type, floor, capacity, price in ROOM_SEEDS:
        ref = db.collection("rooms").document(room_number)
        batch.set(
            ref,
            {
                "room_number": room_number,
                "room_type": room_type,
                "category": room_type,
                "floor": floor,
                "capacity": capacity,
                "price": price,
                "status": "available",
                "booked_dates": [],
                "blocked_dates": [],
                "created_at": server_timestamp(),
                "updated_at": server_timestamp(),
            },
        )
    batch.commit()
from flask import Blueprint, jsonify, request

from services.date_utils import each_date_inclusive
from services.default_data import ensure_seed_rooms
from services.firestore_client import get_db

rooms_bp = Blueprint("rooms", __name__)


PHOTO_IDS = [
    "photo-1582719478250-c89cae4dc85b", "photo-1590490360182-c33d57733427", "photo-1618773928121-c32242e63f39",
    "photo-1595576508898-0ad5c879a061", "photo-1631049307264-da0ec9d70304", "photo-1611892440504-42a792e24d32",
    "photo-1578683010236-d716f9a3f461", "photo-1566665797739-1674de7a421a", "photo-1598928506311-c55ded91a20c",
    "photo-1600210492486-724fe5c67fb0", "photo-1616486338812-3dadae4b4ace", "photo-1600566753190-17f0baa2a6c3",
    "photo-1600607687939-ce8a6c25118c", "photo-1600585154340-be6161a56a0c", "photo-1600566752355-35792bedcfea",
    "photo-1600607687920-4e2a09cf159d", "photo-1600210491892-03d54c0aaf87", "photo-1551882547-ff40c63fe5fa",
    "photo-1445019980597-93fa8acb246c", "photo-1571896349842-33c89424de2d", "photo-1540541338287-41700207dee6",
    "photo-1520250497591-112f2f40a3f4", "photo-1564501049412-61c2a3083791", "photo-1512918728675-ed5a9ecdebfd",
    "photo-1513694203232-719a280e022f", "photo-1542314831-068cd1dbfeeb", "photo-1521783593447-5702b9bfd267",
    "photo-1517840901100-8179e982acb7", "photo-1549294413-26f195200c16", "photo-1595877244574-e90ce41ce089",
    "photo-1596394516093-501ba68a0ba6", "photo-1584132967334-10e028bd69f7", "photo-1551918120-9739cb430c6d",
    "photo-1618220179428-22790b461013", "photo-1554995207-c18c203602cb", "photo-1484154218962-a197022b5858",
    "photo-1615874694520-474822394e73", "photo-1560185127-6ed189bf02f4", "photo-1616137466211-f939a420be84",
    "photo-1595526114035-0d45ed16cfbf"
]

BASE_AMENITIES = ["Free High-Speed WiFi", "Climate Control", "24/7 Room Service", "In-room Safe", "Smart TV", "Premium Bedding"]
UNIQUE_FEATURES = [
    "Private Balcony with City View", "Ocean View", "Deep Soaking Tub", "Nespresso Coffee Machine",
    "Fully Stocked Mini Bar", "Complimentary Breakfast", "Luxury Bathrobes & Slippers", 
    "Work Desk with Ergonomic Chair", "Lounge Area with Sofa", "Double Vanity Bathroom",
    "Walk-in Rainfall Shower", "Evening Turndown Service", "Welcome Fruit Basket",
    "Bluetooth Sound System", "Smart Room Controls"
]


def image_from_id(id_str, width=1600, height=1000):
    return f"https://images.unsplash.com/{id_str}?auto=format&fit=crop&w={width}&h={height}&q=84"


def get_seed_from_room(room_number):
    try:
        room_str = str(room_number)
        floor = int(room_str[0]) if room_str[0].isdigit() else 1
        room_idx = int(room_str[-2:]) if room_str[-2:].isdigit() else 1
        return (floor - 1) * 5 + (room_idx - 1)
    except:
        return 1


def gallery_for_room(room_number):
    seed = get_seed_from_room(room_number)
    return [
        image_from_id(PHOTO_IDS[(seed + i * 7) % len(PHOTO_IDS)], 1800 if i == 0 else 1200, 900)
        for i in range(6)
    ]


def amenities_for_room(room_number, category):
    seed = get_seed_from_room(room_number)
    features = list(BASE_AMENITIES)
    
    # 3 to 5 unique features based on room mapping
    num_unique = 3 + (seed % 3)
    for i in range(num_unique):
        feature_idx = (seed + i * 4) % len(UNIQUE_FEATURES)
        if UNIQUE_FEATURES[feature_idx] not in features:
            features.append(UNIQUE_FEATURES[feature_idx])
            
    # Add category specific premium features
    if category and "Suite" in category:
        if "Personal Butler Service" not in features: features.append("Personal Butler Service")
        if "Private Jacuzzi" not in features: features.append("Private Jacuzzi")
        
    return features


def room_to_dict(snapshot):
    data = snapshot.to_dict() or {}
    category = data.get("category") or data.get("room_type", "Room")
    return {
        "id": snapshot.id,
        "number": data.get("room_number", snapshot.id),
        "roomNumber": data.get("room_number", snapshot.id),
        "category": category,
        "roomType": data.get("room_type") or category,
        "title": data.get("title") or f"{category} {data.get('room_number', snapshot.id)}",
        "subtitle": data.get("subtitle", "Luxury experience"),
        "description": data.get("description", "A beautiful room designed for your comfort and luxury."),
        "floor": data.get("floor", "Floor 1"),
        "capacity": data.get("capacity", 2),
        "guests": data.get("capacity", 2),
        "beds": data.get("beds", 1),
        "size": data.get("size", "400 sq ft"),
        "rating": data.get("rating", 5.0),
        "reviews": data.get("reviews", 12),
        "price": data.get("price", 0),
        "status": data.get("status", "available"),
        "bookedDates": data.get("booked_dates", []),
        "blockedDates": data.get("blocked_dates", []),
        "amenities": amenities_for_room(snapshot.id, category),
        "images": gallery_for_room(snapshot.id),
    }


@rooms_bp.get("/room-categories")
def room_categories():
    ensure_seed_rooms()
    categories = sorted({(room.to_dict() or {}).get("room_type") for room in get_db().collection("rooms").stream()})
    return jsonify({"categories": [category for category in categories if category]})


@rooms_bp.get("/rooms")
def list_rooms():
    ensure_seed_rooms()
    category = request.args.get("category")
    query = get_db().collection("rooms")
    if category:
        query = query.where("room_type", "==", category)
    rooms = sorted([room_to_dict(room) for room in query.stream()], key=lambda item: item["roomNumber"])
    return jsonify({"rooms": rooms})


@rooms_bp.get("/rooms/<room_id>")
def room_detail(room_id):
    ensure_seed_rooms()
    room = get_db().collection("rooms").document(str(room_id)).get()
    if not room.exists:
        return jsonify({"message": "Room not found"}), 404
    return jsonify(room_to_dict(room))


@rooms_bp.get("/rooms/<room_id>/availability")
def room_availability(room_id):
    ensure_seed_rooms()
    room = get_db().collection("rooms").document(str(room_id)).get()
    if not room.exists:
        return jsonify({"message": "Room not found"}), 404
    data = room.to_dict() or {}
    dates = each_date_inclusive(request.args.get("start"), request.args.get("end")) if request.args.get("start") and request.args.get("end") else []
    booked = set(data.get("booked_dates", []))
    blocked = set(data.get("blocked_dates", []))
    return jsonify(
        {
            "roomId": room.id,
            "dates": [
                {"date": date, "status": "blocked" if date in blocked else "booked" if date in booked else "available"}
                for date in dates
            ],
        }
    )
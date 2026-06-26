from datetime import datetime

from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import UniqueConstraint
from sqlalchemy.dialects.mysql import JSON
from werkzeug.security import check_password_hash, generate_password_hash

db = SQLAlchemy()


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(160), unique=True, nullable=False, index=True)
    phone = db.Column(db.String(20))
    password_hash = db.Column(db.String(255))
    role = db.Column(db.String(20), default="customer", nullable=False)
    google_id = db.Column(db.String(180), unique=True)
    avatar_url = db.Column(db.String(500))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    bookings = db.relationship("Booking", backref="user", lazy=True)
    reviews = db.relationship("Review", backref="user", lazy=True)
    wishlist_items = db.relationship("Wishlist", backref="user", lazy=True, cascade="all, delete-orphan")

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return bool(self.password_hash and check_password_hash(self.password_hash, password))

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.full_name,
            "email": self.email,
            "phone": self.phone,
            "role": self.role,
            "avatar": self.avatar_url,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }


class Room(db.Model):
    __tablename__ = "rooms"

    id = db.Column(db.Integer, primary_key=True)
    room_number = db.Column(db.String(20), unique=True, nullable=False, index=True)
    category = db.Column(db.String(80), nullable=False, index=True)
    title = db.Column(db.String(120), nullable=False)
    description = db.Column(db.Text)
    price_per_night = db.Column(db.Numeric(10, 2), nullable=False)
    guest_capacity = db.Column(db.Integer, nullable=False)
    beds = db.Column(db.Integer, default=1)
    size = db.Column(db.String(50))
    status = db.Column(db.String(30), default="available")
    images = db.Column(JSON, default=list)
    amenities = db.Column(JSON, default=list)
    blocked_dates = db.Column(JSON, default=list)
    booked_dates = db.Column(JSON, default=list)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    bookings = db.relationship("Booking", backref="room", lazy=True)
    reviews = db.relationship("Review", backref="room", lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "roomNumber": self.room_number,
            "category": self.category,
            "title": self.title,
            "description": self.description,
            "price": float(self.price_per_night),
            "guests": self.guest_capacity,
            "beds": self.beds,
            "size": self.size,
            "status": self.status,
            "images": self.images or [],
            "amenities": self.amenities or [],
            "blockedDates": self.blocked_dates or [],
            "bookedDates": self.booked_dates or [],
        }


class Booking(db.Model):
    __tablename__ = "bookings"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    room_id = db.Column(db.Integer, db.ForeignKey("rooms.id"), nullable=False)
    check_in = db.Column(db.Date, nullable=False)
    check_out = db.Column(db.Date, nullable=False)
    guests = db.Column(db.Integer, nullable=False)
    nights = db.Column(db.Integer, nullable=False)
    total_amount = db.Column(db.Numeric(10, 2), nullable=False)
    status = db.Column(db.String(30), default="confirmed")
    payment_status = db.Column(db.String(30), default="pending")
    payment_method = db.Column(db.String(30))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    payments = db.relationship("Payment", backref="booking", lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "room": self.room.to_dict() if self.room else None,
            "checkIn": self.check_in.isoformat(),
            "checkOut": self.check_out.isoformat(),
            "guests": self.guests,
            "nights": self.nights,
            "totalAmount": float(self.total_amount),
            "status": self.status,
            "paymentStatus": self.payment_status,
            "paymentMethod": self.payment_method,
        }


class Payment(db.Model):
    __tablename__ = "payments"

    id = db.Column(db.Integer, primary_key=True)
    booking_id = db.Column(db.Integer, db.ForeignKey("bookings.id"))
    provider = db.Column(db.String(40), nullable=False)
    provider_order_id = db.Column(db.String(180))
    provider_payment_id = db.Column(db.String(180))
    invoice_number = db.Column(db.String(80), unique=True, nullable=False)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    status = db.Column(db.String(30), default="created")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "provider": self.provider,
            "orderId": self.provider_order_id,
            "paymentId": self.provider_payment_id,
            "invoiceNumber": self.invoice_number,
            "amount": float(self.amount),
            "status": self.status,
        }


class Review(db.Model):
    __tablename__ = "reviews"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    room_id = db.Column(db.Integer, db.ForeignKey("rooms.id"), nullable=False)
    rating = db.Column(db.Integer, nullable=False)
    comment = db.Column(db.Text, nullable=False)
    photo_url = db.Column(db.String(500))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "user": self.user.full_name if self.user else "Guest",
            "rating": self.rating,
            "comment": self.comment,
            "photoUrl": self.photo_url,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }


class Wishlist(db.Model):
    __tablename__ = "wishlists"
    __table_args__ = (UniqueConstraint("user_id", "room_id", name="uniq_user_room_wishlist"),)

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    room_id = db.Column(db.Integer, db.ForeignKey("rooms.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    room = db.relationship("Room")

    def to_dict(self):
        return {"id": self.id, "room": self.room.to_dict() if self.room else None}
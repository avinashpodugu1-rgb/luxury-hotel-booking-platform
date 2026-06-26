CREATE DATABASE IF NOT EXISTS room_availability_calendar;
USE room_availability_calendar;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  phone VARCHAR(20),
  password_hash VARCHAR(255),
  role VARCHAR(20) NOT NULL DEFAULT 'customer',
  google_id VARCHAR(180) UNIQUE,
  avatar_url VARCHAR(500),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rooms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_number VARCHAR(20) NOT NULL UNIQUE,
  category VARCHAR(80) NOT NULL,
  title VARCHAR(120) NOT NULL,
  description TEXT,
  price_per_night DECIMAL(10, 2) NOT NULL,
  guest_capacity INT NOT NULL,
  beds INT DEFAULT 1,
  size VARCHAR(50),
  status VARCHAR(30) DEFAULT 'available',
  images JSON,
  amenities JSON,
  blocked_dates JSON,
  booked_dates JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  room_id INT NOT NULL,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  guests INT NOT NULL,
  nights INT NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(30) DEFAULT 'confirmed',
  payment_status VARCHAR(30) DEFAULT 'pending',
  payment_method VARCHAR(30),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (room_id) REFERENCES rooms(id)
);

CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT,
  provider VARCHAR(40) NOT NULL,
  provider_order_id VARCHAR(180),
  provider_payment_id VARCHAR(180),
  invoice_number VARCHAR(80) NOT NULL UNIQUE,
  amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(30) DEFAULT 'created',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id)
);

CREATE TABLE IF NOT EXISTS reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  room_id INT NOT NULL,
  rating INT NOT NULL,
  comment TEXT NOT NULL,
  photo_url VARCHAR(500),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (room_id) REFERENCES rooms(id)
);

CREATE TABLE IF NOT EXISTS wishlists (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  room_id INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_user_room_wishlist (user_id, room_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (room_id) REFERENCES rooms(id)
);
# System Architecture — Room Availability Calendar

## Overview

Room Availability Calendar is a full-stack hotel operations prototype built for SRI NIRVANA PLAZA. It solves the problem of scattered room availability tracking by providing a real-time, conflict-preventing digital calendar for front desk staff, hotel managers, and guests.

## Architecture Layers

### 1. Frontend Layer
- **Technology:** React 19, TypeScript, Vite, Tailwind CSS, Framer Motion, Chart.js
- **Key pages:**
  - `ArenaInspiredHomePage` — Guest-facing booking page with 7-day availability calendar, room type filter, booking popup, KPI cards
  - `EnterpriseAdminPage` — 19-module staff dashboard: overview, calendar, rooms, bookings, guests, corporate, self-check-in, housekeeping, room service, complaints, feedback, payments & GST, revenue analytics, AI center, notifications, action history, reports, maintenance, profile
  - `App.tsx` — Main router, auth modals, invoice PDF generation (jsPDF), room detail pages
- **State management:** HotelContext (React Context API) — handles auth, wishlist, theme, user session
- **API communication:** Axios via `src/services/api.ts` — base URL from `VITE_API_URL` env variable

### 2. Backend Layer
- **Technology:** Python Flask 3.0, Flask-JWT-Extended, Flask-CORS, python-dotenv
- **Blueprint structure:**
  - `/api/auth` — register, login, Google OAuth, profile
  - `/api/rooms` — list rooms, room detail, availability by date range
  - `/api/bookings` — create booking (with conflict check), list bookings
  - `/api/payments` — create Razorpay order, verify payment
  - `/api/wishlist` — toggle and fetch saved rooms
  - `/api/admin` — admin-only: dashboard stats, room CRUD, block rooms, manage bookings and users
  - `/api/<collection>` — generic CRUD for all operations collections (enquiries, housekeeping, complaints, etc.)
  - `/api/calendar` — date-wise room status grid for a given date range
  - `/api/analytics/summary` — rule-based occupancy summary and allocation priorities

### 3. Database Layer
- **Primary:** Firebase Firestore (NoSQL, real-time)
  - Collections: users, rooms, bookings, payments, reviews, wishlists, gst_entries, enquiries, corporate_bookings, housekeeping_tasks, room_service_orders, complaints, feedback, seasonal_rates, loyalty_accounts, shift_handover_logs, maintenance_blocks
- **Reference schema:** MySQL schema in `backend/database/schema.sql` (for SQL-based deployments)
- **Seed data:** 25 rooms across 5 floors auto-seeded on first API call via `services/default_data.py`

### 4. AI / Rule-Based Logic Layer
- **Module:** `backend/controllers/analytics_controller.py`
- **Functions:**
  - `get_occupancy_summary` — total, booked, available, blocked counts + revenue
  - `get_room_allocation_priorities` — rule-based: checkouts today, arrivals tomorrow, long maintenance blocks, upsell opportunities
  - `get_upcoming_occupancy_text` — plain-text 7-day forecast for AI Center display

### 5. External Services
- **Razorpay** — Payment gateway for INR transactions. Configured via `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`
- **Google OAuth** — Guest login via Google. Configured via `GOOGLE_CLIENT_ID`
- **Notification stub** — `services/notification_stub.py` logs booking confirmations, check-in reminders, complaint escalations. Replace print statements with WhatsApp Business API or SendGrid in production
- **GST service** — `services/gst_service.py` auto-generates CGST + SGST breakdown on every confirmed booking

### 6. Deployment
- **Frontend:** Vercel or Netlify (set `VITE_API_URL` to deployed backend URL)
- **Backend:** Render or Railway free tier (set all env vars from `.env.example`)
- **Database:** Firebase Firestore hosted on Google Cloud (no separate deployment needed)

## Data Flow — Room Booking
Guest fills booking form (Frontend)

-> POST /api/bookings (Backend)

-> Firestore transaction: check booked_dates + blocked_dates on room

-> Conflict? Return 409

-> No conflict? Write booking doc + update room.booked_dates

-> Auto-create GST entry (gst_service.py)

-> Send booking confirmation log (notification_stub.py)

-> Return booking object to frontend

-> Frontend shows success message + invoice download option

## Data Flow — Room Calendar
Staff opens calendar view (Frontend)

-> GET /api/calendar?start=2026-07-01&end=2026-07-07 (Backend)

-> Fetch all rooms from Firestore

-> For each room, for each date: check booked_dates and blocked_dates sets

-> Return sorted array: [{roomNumber, roomType, dates: [{date, status}]}]

-> Frontend renders colour-coded grid

-> Green = available, Red = booked, Amber = maintenance/blocked
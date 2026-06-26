# Test Tracker — Room Availability Calendar

**Project:** Room Availability Calendar | **Company:** SRI NIRVANA PLAZA  
**Tester:** Student 3 — Testing & Deployment  
**Base URL:** http://localhost:5000 (local) / https://your-api.onrender.com (deployed)

| Test ID | Module | Description | Method & Endpoint | Request Body / Params | Expected Result | Actual Result | Status |
|---------|--------|-------------|-------------------|-----------------------|-----------------|---------------|--------|
| T001 | Auth | Register new customer | POST /api/auth/register | `{"fullName":"Test Guest","email":"test@hotel.com","phone":"9876543210","password":"Test@1234"}` | 201, returns token + user object with role=customer | | |
| T002 | Auth | Login with valid credentials | POST /api/auth/login | `{"email":"test@hotel.com","password":"Test@1234","role":"customer"}` | 200, returns token + user | | |
| T003 | Auth | Login with wrong password | POST /api/auth/login | `{"email":"test@hotel.com","password":"wrongpass","role":"customer"}` | 401 Invalid email or password | | |
| T004 | Auth | Duplicate email registration | POST /api/auth/register | Same email as T001 | 409 Email already registered | | |
| T005 | Rooms | List all rooms | GET /api/rooms | — | 200, array of 25 rooms with roomNumber, category, price, status | | |
| T006 | Rooms | Filter rooms by category | GET /api/rooms?category=Deluxe | — | 200, only rooms with room_type=Deluxe | | |
| T007 | Rooms | Get single room detail | GET /api/rooms/101 | — | 200, room 101 details with bookedDates and blockedDates | | |
| T008 | Rooms | Get room availability for date range | GET /api/rooms/101/availability?start=2026-07-01&end=2026-07-07 | — | 200, array of 7 dates each with status available/booked/blocked | | |
| T009 | Calendar | Get calendar for date range | GET /api/calendar?start=2026-07-01&end=2026-07-07 | — | 200, all 25 rooms with per-date status grid | | |
| T010 | Calendar | Missing date params | GET /api/calendar | — | 400 start and end query params are required | | |
| T011 | Bookings | Create valid booking (requires T002 token) | POST /api/bookings | `{"roomId":"103","checkIn":"2026-08-01","checkOut":"2026-08-03","guests":2,"guestName":"Test Guest","email":"test@hotel.com","paymentMethod":"UPI"}` | 201, booking confirmed, total_amount calculated correctly | | |
| T012 | Bookings | Create booking same room same dates (conflict) | POST /api/bookings | Same payload as T011 | 409 These dates are no longer available | | |
| T013 | Bookings | Missing roomId | POST /api/bookings | `{"checkIn":"2026-08-05","checkOut":"2026-08-07","guests":1}` | 400 roomId is required | | |
| T014 | Bookings | Exceed room capacity | POST /api/bookings | roomId=101 (capacity 1) with guests=5 | 400 Guest count exceeds the room's maximum occupancy | | |
| T015 | Operations | Create housekeeping task | POST /api/housekeeping_tasks | `{"room_id":"101","task_type":"cleaning","status":"pending","assigned_to":"Staff A","priority":"High","notes":"Post-checkout deep clean"}` | 201, document created with id | | |
| T016 | Operations | Create maintenance block | POST /api/maintenance_blocks | `{"room_id":"102","start_date":"2026-07-10","end_date":"2026-07-12","reason":"AC repair","created_by":"Manager","status":"active"}` | 201, room 102 blocked_dates updated with 10, 11, 12 July | | |
| T017 | Operations | Complete maintenance block restores room | PUT /api/maintenance_blocks/<id from T016> | `{"status":"completed"}` | 200, room 102 status restored to available | | |
| T018 | Analytics | Get occupancy summary | GET /api/analytics/summary | — | 200, returns occupancy_summary, allocation_priorities, occupancy_text | | |
| T019 | Admin | Non-admin blocked | GET /api/admin/dashboard | Authorization: Bearer {{customer_token}} | 403 Admin access required | | |
| T020 | Integration | Full flow: book then verify calendar reflects booking | T011 then GET /api/calendar?start=2026-08-01&end=2026-08-03 | — | Room 103 shows status=booked on 2026-08-01 and 2026-08-02 in calendar response | | |
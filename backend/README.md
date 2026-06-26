# Room Availability Calendar Backend

Python Flask API for SRI NIRVANA PLAZA with MySQL, SQLAlchemy, JWT authentication, Google OAuth verification, booking, payments, reviews, wishlist, and admin APIs.

## Local Setup

1. Create a MySQL database using `backend/database/schema.sql`.
2. Seed rooms with `backend/database/seed.sql`.
3. Create a virtual environment and install `backend/requirements.txt`.
4. Set environment variables: `DATABASE_URL`, `JWT_SECRET_KEY`, `GOOGLE_CLIENT_ID`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `FRONTEND_URL`.
5. Run `flask --app app run` from the `backend` directory.

## Deployment

Use Render for Flask and a managed MySQL database. Use Vercel for the React frontend and set `VITE_API_URL` to the Render API URL.
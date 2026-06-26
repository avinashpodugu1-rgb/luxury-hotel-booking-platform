# Luxury Hotel Booking Platform

A full-stack luxury hotel booking platform with real-time room availability, booking management, payment processing, and admin dashboard.

## Tech Stack

**Frontend** (deployed on Vercel)
- React 19 + TypeScript + Vite
- TailwindCSS v4
- Firebase Auth (Google OAuth)
- Razorpay Payments
- Framer Motion animations

**Backend** (deployed on Render)
- Python Flask REST API
- Firebase Firestore (database)
- JWT authentication
- WhatsApp & Email notifications
- Razorpay payment integration

---

## Local Development

### Prerequisites
- Node.js 18+
- Python 3.11+
- Firebase project with Firestore enabled

### Frontend Setup

```bash
# Install dependencies
npm install

# Create local env file
cp .env.example .env.local
# Edit .env.local and set VITE_API_URL=http://localhost:5000/api

# Start dev server
npm run dev
```

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv .venv
.venv\Scripts\activate       # Windows
# source .venv/bin/activate  # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Create env file
cp .env.example .env
# Edit .env with your credentials

# Run Flask server
python app.py
```

---

## Deployment

### Frontend → Vercel
1. Connect GitHub repo to Vercel
2. Set environment variable: `VITE_API_URL=https://your-render-backend.onrender.com/api`
3. Vercel auto-detects Vite — deploy!

### Backend → Render
1. Connect GitHub repo to Render
2. Use the `render.yaml` blueprint (auto-detected)
3. Set all secret environment variables in Render dashboard:
   - `SECRET_KEY`, `JWT_SECRET_KEY`
   - `FIREBASE_PROJECT_ID`, `FIREBASE_CREDENTIALS_JSON` (full JSON string)
   - `SMTP_USERNAME`, `SMTP_PASSWORD`
   - `FRONTEND_URL` (your Vercel URL)

---

## Environment Variables

See `backend/.env.example` for a full list of required backend environment variables.

Frontend env vars:
| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API base URL |
| `VITE_FIREBASE_*` | Firebase config (if using client-side Firebase) |

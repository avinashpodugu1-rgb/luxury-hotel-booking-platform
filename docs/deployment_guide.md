# Deployment Guide — Room Availability Calendar

## Prerequisites
- Node.js 18+ and npm
- Python 3.11+
- A Firebase project (free Spark plan is sufficient)
- A Render or Railway account (free tier)
- A Vercel or Netlify account (free tier)

---

## Step 1 — Firebase Setup
1. Go to https://console.firebase.google.com and create a new project named `room-availability-calendar`
2. Go to **Project Settings → Service Accounts → Generate New Private Key**
3. Download the JSON file and save it as `backend/serviceAccountKey.json`
4. Go to **Firestore Database → Create Database** — choose production mode, select a region close to India (e.g. asia-south1)
5. Copy your **Project ID** from Project Settings

---

## Step 2 — Backend Local Setup
```bash
cd backend
cp .env.example .env
# Edit .env and fill in all values
pip install -r requirements.txt
python app.py
# Backend runs at http://localhost:5000
# Test: GET http://localhost:5000/api/health -> {"status": "ok"}
```

---

## Step 3 — Frontend Local Setup
```bash
# In project root
cp .env.example .env.local   # create if not exists
# Add to .env.local:
# VITE_API_URL=http://localhost:5000/api
# VITE_GOOGLE_CLIENT_ID=your-google-client-id
npm install
npm run dev
# Frontend runs at http://localhost:5173
```

---

## Step 4 — Deploy Backend to Render
1. Push your code to a GitHub repository
2. Go to https://render.com → New → Web Service → Connect your repo
3. Set these build settings:
   - **Root directory:** `backend`
   - **Build command:** `pip install -r requirements.txt`
   - **Start command:** `gunicorn app:app`
4. Add `gunicorn` to `backend/requirements.txt`
5. Go to **Environment** tab and add all variables from `.env.example` with real values
6. Set `FIREBASE_CREDENTIALS_JSON` to the full JSON contents of your serviceAccountKey.json (paste as a single line)
7. Click **Deploy** — note your deployed URL e.g. `https://room-calendar-api.onrender.com`

---

## Step 5 — Deploy Frontend to Vercel
1. Go to https://vercel.com → New Project → Import your GitHub repo
2. Set **Root Directory** to the project root (where package.json is)
3. Go to **Environment Variables** and add:
   - `VITE_API_URL` = `https://room-calendar-api.onrender.com/api`
   - `VITE_GOOGLE_CLIENT_ID` = your Google OAuth client ID
4. Click **Deploy**
5. Note your deployed frontend URL e.g. `https://room-availability-calendar.vercel.app`

---

## Step 6 — Update CORS
In your Render environment variables, set:
FRONTEND_URL=https://room-availability-calendar.vercel.app
Redeploy the backend.

---

## Step 7 — Post-deployment Test Checklist
- [ ] GET `https://your-api.onrender.com/api/health` returns `{"status": "ok"}`
- [ ] GET `https://your-api.onrender.com/api/rooms` returns 25 seeded rooms
- [ ] GET `https://your-api.onrender.com/api/calendar?start=2026-07-01&end=2026-07-07` returns room grid
- [ ] Frontend loads at Vercel URL
- [ ] Guest can register, login, view rooms, and make a booking
- [ ] Admin login works and dashboard shows room counts
- [ ] Booking creates GST entry visible in admin Payments & GST module
- [ ] All test cases in `/tests/test_tracker.md` pass at deployed URL

---

## Troubleshooting
| Issue | Fix |
|-------|-----|
| Backend returns 500 on first request | Check Render logs — likely missing FIREBASE_CREDENTIALS_JSON env var |
| CORS error on frontend | Confirm FRONTEND_URL in backend env matches exact Vercel URL including https:// |
| Google login fails | Add Vercel URL to Google Cloud Console → OAuth 2.0 → Authorised JavaScript origins |
| Rooms list empty | First request auto-seeds 25 rooms — try the request again |
| Payment order creation fails | Razorpay demo mode returns a mock order — ensure RAZORPAY_KEY_ID starts with rzp_test_ |
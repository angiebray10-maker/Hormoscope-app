# HORMOscope

HORMOscope is a women's cycle-tracking web app with a twist: instead of just a
calendar, it gives a daily personalized hormonal reading (energy, mood, pain,
libido) based on the user's cycle phase, plus an AI coach chat ("Boyfriend
Mode" for premium users), cycle/intimacy/journal logging, hormone insights
charts, partner sharing links, and web push notifications.

## Repo structure

```
Hormoscope-app/
├── backend/
│   ├── server.py          # FastAPI app — all API routes, auth, Stripe, AI chat
│   ├── requirements.txt   # Python dependencies
│   └── tests/             # Backend tests (pytest, e2e against a running server)
├── frontend/
│   ├── public/            # Static assets (favicons, manifest, self-hosted images in public/images/)
│   ├── src/
│   │   ├── pages/         # Auth, Home, Calendar, Chat, Insights, Journal, Pro, Profile, ...
│   │   ├── components/    # BottomNav, Paywall, PushNotificationPrompt, ...
│   │   ├── context/       # AuthContext (token storage, session)
│   │   └── lib/ utils/ hooks/
│   └── package.json       # Create React App (craco) frontend
├── backend_test.py        # Legacy API test script
└── tests/                 # Additional test reports
```

The frontend is a Create React App site; the backend is a single FastAPI
module (`backend/server.py`, ~3,100 lines). They talk over REST at `/api/*`.

## Backend environment variables

Create `backend/.env` (never commit it) with:

| Variable | Required | Notes |
|---|---|---|
| `MONGO_URL` | Yes | MongoDB connection string. Server fails fast if unset. Free option: MongoDB Atlas (512 MB free tier). |
| `DB_NAME` | Yes | MongoDB database name. Server fails fast if unset. |
| `JWT_SECRET` | Yes | Secret for signing auth tokens. **No default** — the server refuses to start without it. Generate with `openssl rand -hex 32`. Rotate it on every fresh deploy (old tokens invalidate). |
| `STRIPE_API_KEY` | Only if using Stripe | Stripe secret key. **Note: Stripe is being phased out** in favor of Google Play Billing; the checkout/webhook code is still present but slated for removal. Defaults to a test key — never rely on the default in production. |
| `ANTHROPIC_API_KEY` | No (graceful) | Powers the AI coach (`POST /api/chat`) and the daily reading (`GET /api/premium/daily-read`). If unset, `/api/chat` returns **503** with a friendly message and the daily read falls back to a phase-based template. Billed per token by Anthropic. |
| `ANTHROPIC_MODEL` | No | Defaults to `claude-sonnet-4-5-20250929`. |
| `VAPID_PRIVATE_KEY` / `VAPID_PUBLIC_KEY` / `VAPID_EMAIL` | Only for web push | Keys for Web Push notifications (`/api/push/*`). |
| `CORS_ORIGINS` | No | Comma-separated allowed origins. Defaults to `*` (tighten in production). |
| `FRONTEND_URL` | No | Used as the base for some Stripe redirect URLs. |

## Frontend environment variables

Create `frontend/.env` (Create React App reads `REACT_APP_*` at build time):

| Variable | Required | Notes |
|---|---|---|
| `REACT_APP_BACKEND_URL` | Yes | Base URL of the backend, e.g. `https://api.example.com`. The app cannot talk to the API without it. |
| `REACT_APP_VAPID_PUBLIC_KEY` | Only for web push | Must match the backend's `VAPID_PUBLIC_KEY`. |

## Local dev setup

Prerequisites: Python 3.11+, Node 18+, and a MongoDB instance
(local `mongod` or a free MongoDB Atlas cluster).

```bash
# 1. Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cat > .env <<EOF
MONGO_URL=mongodb://localhost:27017
DB_NAME=hormoscope
JWT_SECRET=$(openssl rand -hex 32)
ANTHROPIC_API_KEY=   # optional; AI chat returns 503 without it
EOF
uvicorn server:app --reload --port 8000

# 2. Frontend (separate terminal)
cd frontend
npm install
cat > .env <<EOF
REACT_APP_BACKEND_URL=http://localhost:8000
EOF
npm start
```

The API serves at `http://localhost:8000/api/*`; the frontend dev server at
`http://localhost:3000`.

## Running tests

Backend tests are end-to-end and need a running server plus MongoDB:

```bash
cd backend
REACT_APP_BACKEND_URL=http://localhost:8000 pytest tests/ -x -q
```

(`MONGO_URL`/`DB_NAME` must also be set for the tests that touch Mongo
directly.)

## Security notes (please read before any public deploy)

- `JWT_SECRET` has no default on purpose. Never commit a real one.
- `/api/admin/users` and `/api/admin/analytics` require a logged-in user.
  There is no role system yet — any authenticated user can call them.
- There is intentionally **no** self-serve premium endpoint: the old
  `/api/premium/manual-unlock` (grant yourself Pro, no payment) was removed.
  Premium is granted only by verified payment webhooks.
- Stripe webhook signature verification is not yet implemented — treat the
  Stripe flow as legacy until the Google Play Billing migration lands.

## Deployment notes

- Images that used to live on Emergent's CDN are now self-hosted in
  `frontend/public/images/` (served from `/images/...`).
- The AI chat calls Anthropic directly — no Emergent dependency remains in
  the request path. The `emergentintegrations` Python package is still listed
  in `backend/requirements.txt` because the (legacy) Stripe checkout code
  imports from it; it can be dropped when Stripe is removed.
- Before a Google Play release: the current in-app subscription flow uses
  Stripe web checkout, which Play policy does not allow for digital goods —
  migrate to Google Play Billing first.

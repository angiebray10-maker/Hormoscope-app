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
| `REACT_APP_BACKEND_URL` | Yes | Base URL of the backend, e.g. `https://api.example.com`. The app cannot talk to the API without it. **For the Play Store build this must be the production backend URL at build time** (CRA embeds it). |
| `REACT_APP_VAPID_PUBLIC_KEY` | Only for web push | Must match the backend's `VAPID_PUBLIC_KEY`. |
| `REACT_APP_REVENUECAT_ANDROID_API_KEY` | Only for the native Android app | RevenueCat **public** Android key (starts with `goog_`). Enables Google Play Billing in the Capacitor app. If unset, the native app falls back to the web/Stripe flow (which Play policy forbids — don't ship that). |
| `REACT_APP_REVENUECAT_ENTITLEMENT_ID` | No | RevenueCat entitlement id. Default: `pro`. Must match the entitlement created in the RevenueCat dashboard. |
| `REACT_APP_REVENUECAT_OFFERING_ID` | No | RevenueCat offering id. Default: `default`. |
| `REACT_APP_REVENUECAT_YEARLY_PACKAGE_ID` / `REACT_APP_REVENUECAT_MONTHLY_PACKAGE_ID` | No | Override which RevenueCat package backs the Yearly/Monthly buttons. By default the code matches packages by type (`ANNUAL` / `MONTHLY`). |

## Backend environment variables (RevenueCat additions)

| Variable | Required | Notes |
|---|---|---|
| `REVENUECAT_SECRET_API_KEY` | For native app | Secret key from RevenueCat dashboard. Used by `POST /api/subscription/revenuecat/sync` to verify entitlements server-side. Never expose to the frontend. |
| `REVENUECAT_WEBHOOK_AUTH` | For native app | Shared secret placed in the `Authorization` header of the RevenueCat dashboard webhook pointing at `/api/webhooks/revenuecat`. |
| `REVENUECAT_ENTITLEMENT_ID` | No | Default: `pro`. Must match the frontend's `REACT_APP_REVENUECAT_ENTITLEMENT_ID`. |

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

## Android (Capacitor) build

The web app is wrapped with [Capacitor](https://capacitorjs.com) for the
Google Play release (`@capacitor/core`, `@capacitor/cli`, `@capacitor/android`,
`@revenuecat/purchases-capacitor` in `frontend/package.json`).

```bash
cd frontend
npm install                       # use --legacy-peer-deps (pre-existing peer conflict)
# capacitor.config.ts already exists: appId com.hormoscope.app, webDir build
npm run build                     # REACT_APP_* env vars are baked in here
npx cap sync                      # copies build/ into android/
```

Then open `frontend/android/` in Android Studio (or use the CLI with an
Android SDK installed) to build the release AAB for Play Console.

**Play Billing setup (all dashboard work, in order):**
1. Google Play Console: pay the $25 one-time registration, create the app,
   then Monetize > Subscriptions: create the monthly and yearly products.
2. Firebase Console (free): create a project, add the Android app
   (`com.hormoscope.app`), download `google-services.json` into
   `frontend/android/app/` (needed for push notifications in production builds).
3. RevenueCat dashboard: create account + app, connect Google Play (service
   credentials JSON from Play Console), create Entitlement `pro`, attach the
   Play products, create Offering `default` with the monthly + yearly packages.
4. RevenueCat dashboard > Integrations > Webhooks: add
   `https://<backend-host>/api/webhooks/revenuecat` with an Authorization
   header value; set the same value as `REVENUECAT_WEBHOOK_AUTH` on the backend.
5. Build the frontend with `REACT_APP_BACKEND_URL` (production),
   `REACT_APP_REVENUECAT_ANDROID_API_KEY`, and matching entitlement/offering ids.

How billing behaves per platform:
- **Native Android app**: paywall uses RevenueCat → Google Play Billing
  (prices come from the Play Store, localized). Includes Restore Purchases.
  Entitlement is checked via the RevenueCat SDK; the backend is synced through
  `POST /api/subscription/revenuecat/sync` and the RevenueCat webhook.
- **Web**: unchanged Stripe checkout flow (kept intentionally for the web
  version; do not expose it inside the Play build).

## Deployment notes

- Images that used to live on Emergent's CDN are now self-hosted in
  `frontend/public/images/` (served from `/images/...`).
- The AI chat calls Anthropic directly — no Emergent dependency remains in
  the request path. The `emergentintegrations` Python package is still listed
  in `backend/requirements.txt` because the (legacy) Stripe checkout code
  imports from it; it can be dropped when Stripe is removed.
- Google Play Billing is implemented via RevenueCat for the native Android
  app (see "Android (Capacitor) build" above). The Stripe web-checkout flow
  is kept for the web version only — never expose it inside the Play build,
  or Play policy review will reject it.

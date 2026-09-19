# HORMOscope - Product Requirements Document

## Original Problem Statement
A menstrual cycle tracking and hormonal wellness app called "HORMOscope" providing personalized daily content, mood predictions, and advice based on hormonal cycle.

## Brand Identity
- **Name**: HORMOscope (exact casing)
- **Headings/Logo Font**: Poiret One
- **Body Font**: Poppins
- **Color Palette**: Deep Space Black → Cosmic Teal, Electric Purple buttons, Soft Pink accents, Gold (#D4A853) for Pro
- **Aesthetic**: Feminine Luxe, glass-morphism, parallax
- **NO AI references anywhere** — use "Personalized Cycle Intelligence" / "Your Daily Read" / "cycle-intelligent"

## Core Pages
1. **Landing** (`AuthPage.js`)
2. **Dashboard** (`HomePage.js`) — Daily Read, Daily Rhythm Report, Hormone Map (Pro), Stripe success-page polling
3. **Journal** (`JournalPage.js`) — **PRO-ONLY**, fully locked for free users
4. **Calendar** (`CalendarPage.js`) — Period & intimacy logging
5. **Profile** (`ProfilePage.js`) — Settings, Pro status, logout
6. **Pro Page** (`ProPage.js`) — Direct Stripe Checkout + PayPal + Manual Unlock (instant render, no SDK)
7. **Founder's Note** (`FoundersNotePage.js`) — dance-studio photo by signature

## Payment Strategy (Feb 2026 — current)
**REVENUECAT REMOVED.** The paywall (`/pro`) now offers THREE payment paths:
1. **Direct Stripe Checkout** (PRIMARY) — sticky CTA "Become The Woman You Were Made To Be"
   - POST `/api/payments/v1/checkout/session` with `{plan:"monthly"|"yearly", origin_url}` → returns Stripe Checkout URL → `window.location.href` redirect
   - Server-side immutable amounts in `STRIPE_PACKAGES`: monthly $9.99, yearly $79.99
   - After payment, Stripe redirects to `/?stripe_session_id=...`
   - HomePage polls GET `/api/payments/v1/checkout/status/{sid}` for up to 16s (8 attempts × 2s); flips `is_premium=true` when `payment_status=='paid'`
   - Stripe webhook `POST /api/webhook/stripe` also unlocks Pro asynchronously (idempotent via `_activate_pro_for_user`)
2. **PayPal direct subscription links** — Yearly $79.99 (`P-380677633N8816939NITG3LI`) + Monthly $9.99 (`P-52W662450M0497419NITGTGY`)
3. **Manual Unlock** — discrete "Already Subscribed? Click here" → `POST /api/premium/manual-unlock` flips `is_premium=true`, logs `premium_source=manual_override`

⚠️ **STRIPE_API_KEY in backend/.env is sk_live_... (real money, real charges).**

## Recent Changes
### Feb 2026 (RevenueCat → Direct Stripe rewrite — current session)
- **Removed RevenueCat entirely**: deleted `RevenueCatContext.js`, removed `@revenuecat/purchases-js` package, removed `REACT_APP_REVENUECAT_API_KEY`, deleted the duplicate RevenueCat webhook code. New `PremiumContext.js` reads `is_premium` directly from `/api/auth/me`.
- **Direct Stripe Checkout** (via emergentintegrations.payments.stripe.checkout.StripeCheckout): new endpoints at `/api/payments/v1/checkout/session`, `/api/payments/v1/checkout/status/{sid}`, `/api/webhook/stripe`. Server-side immutable pricing.
- **`/pro` page renders instantly** in 525ms — no SDK init, no spinner-hang risk. Loader2 only shows briefly while redirecting to Stripe.
- **Days Late off-by-one bug fixed** in `calculate_cycle_info`: was `max(0, days_since - cycle_length + 1)`, now `max(0, days_since - cycle_length)`. Day 28 → "not late", Day 29 → "expected today", Day 30 → "2 days late". Frontend HomePage + CalendarPage banner copy updated to handle `days_late=0` case.
- **Pytest regression** at `/app/backend/tests/test_stripe_and_dayslate.py` (9 tests, all pass).

### Earlier Feb 2026
- Removed 3-entry Journal trial; Journal is fully Pro-locked. Backend `POST /api/journal` returns 402 for non-Pro.
- PayPal direct links + manual unlock added.
- Old logo (`job_cycletracker-29`) replaced with `/logo192.png` on Onboarding, Privacy, Terms pages.
- Founder's Note photo updated to new dance-studio image.
- Pro page showcase screenshots regenerated cleanly (780×1688, no browser preview chrome).

## Tech Stack
- **Frontend**: React, Tailwind, Poiret One + Poppins, lucide-react
- **Backend**: FastAPI, MongoDB (Motor), JWT auth
- **Payments**: Direct Stripe Checkout (`emergentintegrations.payments.stripe`) + PayPal direct links + manual unlock
- **LLM**: Emergent universal key for Daily Read

## Key API Endpoints
- `POST /api/auth/signup`, `POST /api/auth/login`, `GET /api/auth/me`
- `POST /api/onboarding`
- `POST /api/payments/v1/checkout/session` — Stripe Checkout (monthly/yearly)
- `GET /api/payments/v1/checkout/status/{session_id}` — Polled by HomePage after Stripe redirect
- `POST /api/webhook/stripe` — Async server-side unlock
- `POST /api/premium/manual-unlock` — Self-serve override (PayPal payers)
- `POST /api/journal` — **402 for non-Pro**
- `GET /api/dashboard`, `GET /api/premium/daily-rhythm`, `GET /api/premium/hormone-map`

## 3rd Party Integrations
- **Stripe** (Direct): `STRIPE_API_KEY` (currently sk_live_...) — uses `emergentintegrations.payments.stripe.checkout.StripeCheckout`
- **PayPal**: direct subscription links via env vars `REACT_APP_PAYPAL_MONTHLY_LINK` / `REACT_APP_PAYPAL_YEARLY_LINK`
- **Emergent LLM Key**: Daily Read text generation

## Database Schema
- `users`: `{id, email, hashed_password, name, birthday, cycle_length, period_length, last_period_date, is_premium, premium_source, premium_activated_at, stripe_customer_id, stripe_subscription_id, onboarding_complete, ...}`
- `payment_transactions`: `{id, session_id, user_id, email, plan, amount, currency, metadata, payment_status, status, pro_granted, pro_granted_at, created_at}`
- `cycle_logs`, `intimacy_logs`, `journal_entries`, `daily_content`

## Prioritized Backlog
### P0 — Done
- ~~Remove RevenueCat~~ ✅
- ~~Direct Stripe Checkout (Monthly $9.99 / Yearly $79.99)~~ ✅
- ~~Fix /pro spinner — instant load~~ ✅
- ~~Fix Days Late off-by-one bug~~ ✅
- ~~Journal locked for non-Pro (no trial)~~ ✅
- ~~PayPal direct links~~ ✅
- ~~Manual Unlock link + backend~~ ✅

### P1 — Pending
- PayPal webhook (`BILLING.SUBSCRIPTION.ACTIVATED`) for auto-unlock after PayPal payment (no need for users to click "Already Subscribed?")
- Tighten `/api/payments/v1/checkout/status/{sid}` — return 403 if session belongs to a different user (currently returns 200 with status data)
- Audit dashboard at `/api/admin/premium-users?source=manual_override` to spot abuse

### P2 — Future
- Weekly Rhythm Review, Monthly Cycle Report, Cycle Planner, Mood correlation
- TTC mode, Partner sharing, PDF exports

### P3 — Refactor
- Break `/app/backend/server.py` (3000+ lines) into `routes/`, `models/`, `services/`
- Split oversized React components

## Critical Notes for Future Agents
- DO NOT use "AI" anywhere in user-facing text
- Brand name "HORMOscope" exact casing
- The deployed live app at `https://cycletracker-29.emergent.host` is BEHIND the preview unless the user redeploys
- STRIPE_API_KEY is currently sk_live — real money flows
- RevenueCat is completely gone. Do not re-add it.

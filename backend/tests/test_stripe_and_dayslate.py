"""Backend regression tests for direct-Stripe rewrite + days_late off-by-one fix.

Covers:
  - POST /api/payments/v1/checkout/session (monthly/yearly/lifetime)
  - GET  /api/payments/v1/checkout/status/{sid}
  - POST /api/premium/manual-unlock + GET /api/auth/me reflects is_premium
  - calculate_cycle_info days_late edge cases via GET /api/dashboard
  - POST /api/journal returns 402 for non-premium users
"""
import os
import time
from datetime import datetime, timedelta, timezone

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://hormone-hub-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")


def _signup_user(suffix=""):
    ts = int(time.time() * 1000)
    email = f"qa_{ts}{suffix}@test.com"
    pw = "TestPass123!"
    r = requests.post(f"{API}/auth/signup", json={"email": email, "password": pw, "name": "QA"}, timeout=30)
    assert r.status_code in (200, 201), f"signup failed: {r.status_code} {r.text}"
    body = r.json()
    token = body.get("access_token") or body.get("token")
    user_id = body.get("user", {}).get("id") or body.get("id")
    # Onboarding with last_period_date = today
    today = datetime.now(timezone.utc).date().isoformat()
    r2 = requests.post(
        f"{API}/onboarding",
        json={
            "name": "QA",
            "cycle_length": 28,
            "period_length": 5,
            "last_period_date": today,
            "birthday": "1995-06-15",
        },
        headers={"Authorization": f"Bearer {token}"},
        timeout=30,
    )
    assert r2.status_code in (200, 201), f"onboarding failed: {r2.status_code} {r2.text}"
    return {"email": email, "password": pw, "token": token, "id": user_id}


@pytest.fixture(scope="module")
def user():
    return _signup_user()


def _auth_headers(u):
    return {"Authorization": f"Bearer {u['token']}"}


# ---- Stripe Checkout ----

class TestStripeCheckout:
    def test_create_monthly_session(self, user):
        r = requests.post(
            f"{API}/payments/v1/checkout/session",
            json={"plan": "monthly", "origin_url": BASE_URL},
            headers=_auth_headers(user),
            timeout=30,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "url" in data and "session_id" in data
        assert data["url"].startswith("https://checkout.stripe.com/"), data["url"]

    def test_create_yearly_session(self, user):
        r = requests.post(
            f"{API}/payments/v1/checkout/session",
            json={"plan": "yearly", "origin_url": BASE_URL},
            headers=_auth_headers(user),
            timeout=30,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["url"].startswith("https://checkout.stripe.com/")
        # Persist for status check
        pytest.session_id = data["session_id"]

    def test_create_lifetime_rejected(self, user):
        r = requests.post(
            f"{API}/payments/v1/checkout/session",
            json={"plan": "lifetime", "origin_url": BASE_URL},
            headers=_auth_headers(user),
            timeout=30,
        )
        assert r.status_code == 400

    def test_get_checkout_status(self, user):
        sid = getattr(pytest, "session_id", None)
        assert sid, "session_id not set by previous test"
        r = requests.get(
            f"{API}/payments/v1/checkout/status/{sid}",
            headers=_auth_headers(user),
            timeout=30,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("status", "payment_status", "amount_total", "currency"):
            assert k in data, f"missing key {k} in {data}"
        # Mongo doc should exist
        mc = MongoClient(MONGO_URL)
        try:
            doc = mc[DB_NAME].payment_transactions.find_one({"session_id": sid})
            assert doc is not None, "payment_transactions doc not created"
            assert doc["user_id"] == user["id"]
            assert doc["amount"] == 79.99
            assert doc["plan"] == "yearly"
        finally:
            mc.close()


# ---- Manual unlock + premium reflection ----

class TestManualUnlockAndJournal:
    def test_journal_locked_before_unlock(self):
        u = _signup_user("_journal")
        r = requests.post(
            f"{API}/journal",
            json={"content": "test entry", "mood": "happy"},
            headers=_auth_headers(u),
            timeout=30,
        )
        assert r.status_code == 402, f"expected 402, got {r.status_code}: {r.text}"
        detail = str(r.json().get("detail", "")).lower()
        assert "hormoscope pro" in detail or "pro" in detail

    def test_manual_unlock_flips_premium(self):
        u = _signup_user("_unlock")
        # Pre-check
        me = requests.get(f"{API}/auth/me", headers=_auth_headers(u), timeout=30).json()
        assert me.get("is_premium") in (False, None)
        # Unlock
        r = requests.post(f"{API}/premium/manual-unlock", json={}, headers=_auth_headers(u), timeout=30)
        assert r.status_code in (200, 201), r.text
        # Verify
        me2 = requests.get(f"{API}/auth/me", headers=_auth_headers(u), timeout=30).json()
        assert me2.get("is_premium") is True, f"is_premium not True: {me2}"
        # Journal now allowed
        r3 = requests.post(
            f"{API}/journal",
            json={"content": "post-unlock entry", "mood": "calm"},
            headers=_auth_headers(u),
            timeout=30,
        )
        assert r3.status_code in (200, 201), r3.text


# ---- Days late off-by-one ----

def _set_last_period_via_mongo(user_id, days_ago):
    """Backdate last_period_date directly in mongo for deterministic days_late tests."""
    mc = MongoClient(MONGO_URL)
    try:
        date_iso = (datetime.now(timezone.utc) - timedelta(days=days_ago)).date().isoformat()
        res = mc[DB_NAME].users.update_one({"id": user_id}, {"$set": {"last_period_date": date_iso}})
        assert res.matched_count == 1, f"user {user_id} not found in mongo"
    finally:
        mc.close()


class TestDaysLate:
    @pytest.mark.parametrize("days_ago,exp_cycle_day,exp_late,exp_days_late", [
        (27, 28, False, 0),  # day 28 — not yet late
        (28, 29, True, 0),   # period expected today → late but 0 days late
        (30, 31, True, 2),   # 2 days late
    ])
    def test_days_late_calculation(self, days_ago, exp_cycle_day, exp_late, exp_days_late):
        u = _signup_user(f"_late{days_ago}")
        _set_last_period_via_mongo(u["id"], days_ago)
        r = requests.get(f"{API}/dashboard", headers=_auth_headers(u), timeout=30)
        assert r.status_code == 200, r.text
        ci = r.json().get("cycle_info", {})
        assert ci.get("cycle_day") == exp_cycle_day, ci
        assert ci.get("period_is_late") is exp_late, ci
        assert ci.get("days_late") == exp_days_late, ci


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

"""
End-to-end backend tests for HORMOscope paywall + Journal lock.
Covers:
  - Fresh user signup + onboarding
  - Journal POST blocked with 402 for non-Pro
  - POST /api/premium/manual-unlock flips is_premium
  - After unlock, journal POST returns 200 with id
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback to frontend .env
    try:
        with open("/app/frontend/.env") as fh:
            for line in fh:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
                    break
    except Exception:
        pass
assert BASE_URL, "REACT_APP_BACKEND_URL must be configured"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def fresh_user(session):
    ts = int(time.time())
    email = f"qa_{ts}@test.com"
    password = "TestPass123!"

    # Signup
    r = session.post(f"{BASE_URL}/api/auth/signup", json={"email": email, "password": password})
    assert r.status_code in (200, 201), f"Signup failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    assert token, f"No token in signup response: {data}"

    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    # Onboarding
    from datetime import date
    payload = {
        "name": "QA User",
        "cycle_length": 28,
        "period_length": 5,
        "last_period_date": date.today().isoformat(),
        "birthday": "1995-06-15",
    }
    r2 = session.post(f"{BASE_URL}/api/onboarding", json=payload, headers=headers)
    assert r2.status_code in (200, 201), f"Onboarding failed: {r2.status_code} {r2.text}"

    return {"email": email, "password": password, "token": token, "headers": headers}


# ---------- Auth / Me ----------

def test_auth_me_is_not_premium(session, fresh_user):
    r = session.get(f"{BASE_URL}/api/auth/me", headers=fresh_user["headers"])
    assert r.status_code == 200, r.text
    me = r.json()
    assert me.get("is_premium") in (False, None), f"Fresh user should NOT be premium: {me}"


# ---------- Journal: locked for free ----------

def test_journal_post_blocked_for_free_user(session, fresh_user):
    r = session.post(
        f"{BASE_URL}/api/journal",
        json={"title": "Should not save", "content": "Locked for non-Pro"},
        headers=fresh_user["headers"],
    )
    assert r.status_code == 402, f"Expected 402 for non-Pro journal POST, got {r.status_code}: {r.text}"
    detail = (r.json().get("detail") or "").lower()
    assert "hormoscope pro" in detail or "pro" in detail, f"Detail should mention Pro: {detail}"


# ---------- Manual unlock ----------

def test_manual_unlock_sets_is_premium(session, fresh_user):
    r = session.post(
        f"{BASE_URL}/api/premium/manual-unlock", json={}, headers=fresh_user["headers"]
    )
    assert r.status_code == 200, f"Manual unlock failed: {r.status_code} {r.text}"
    body = r.json()
    assert body.get("is_premium") is True

    # Verify via /auth/me
    r2 = session.get(f"{BASE_URL}/api/auth/me", headers=fresh_user["headers"])
    assert r2.status_code == 200
    me = r2.json()
    assert me.get("is_premium") is True, f"is_premium should be true after manual-unlock: {me}"


# ---------- Journal write after unlock ----------

def test_journal_post_works_after_unlock(session, fresh_user):
    r = session.post(
        f"{BASE_URL}/api/journal",
        json={"title": "Post-unlock", "content": "Now I can write"},
        headers=fresh_user["headers"],
    )
    assert r.status_code == 200, f"Expected 200 after unlock, got {r.status_code}: {r.text}"
    body = r.json()
    assert "id" in body and body["id"], f"Response should include id: {body}"

    # Confirm visible via GET /api/journal
    r2 = session.get(f"{BASE_URL}/api/journal", headers=fresh_user["headers"])
    assert r2.status_code == 200
    entries = r2.json()
    assert any(e.get("id") == body["id"] for e in entries), "Created entry should appear in GET /journal"

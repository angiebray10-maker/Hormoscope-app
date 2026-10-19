"""Removed premium visualizations: Daily Rhythm Report & Hormone Map.

Both endpoints were removed on Angelita's order (Oct 18, 2026) because they
presented formula-generated hormone levels as if they were measurements.
These tests assert the endpoints are gone (404), with and without auth.
The shared RHYTHM_DATA table and the Daily Read endpoint are unaffected.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://hormone-hub-1.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"

TEST_EMAIL = "test_pro@test.com"
TEST_PASSWORD = "password123"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{API}/auth/login", json={"email": TEST_EMAIL, "password": TEST_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    tok = data.get("access_token") or data.get("token")
    assert tok, f"No token in login response: {data}"
    return tok


@pytest.fixture(scope="module")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


class TestRemovedEndpoints:
    def test_daily_rhythm_removed(self, auth_headers):
        r = requests.get(f"{API}/premium/daily-rhythm", headers=auth_headers, timeout=30)
        assert r.status_code == 404, f"{r.status_code} {r.text}"

    def test_hormone_map_removed(self, auth_headers):
        r = requests.get(f"{API}/premium/hormone-map", headers=auth_headers, timeout=30)
        assert r.status_code == 404, f"{r.status_code} {r.text}"

    def test_insights_removed(self, auth_headers):
        r = requests.get(f"{API}/insights", headers=auth_headers, timeout=30)
        assert r.status_code == 404, f"{r.status_code} {r.text}"

    def test_removed_endpoints_no_auth(self):
        for path in ("/premium/daily-rhythm", "/premium/hormone-map", "/insights"):
            r = requests.get(f"{API}{path}", timeout=15)
            assert r.status_code == 404, f"{path}: {r.status_code}"

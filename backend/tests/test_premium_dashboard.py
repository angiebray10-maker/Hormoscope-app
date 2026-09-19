"""Premium dashboard endpoints: Daily Rhythm Report & Hormone Map."""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://hormone-hub-1.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"

TEST_EMAIL = "test_pro@test.com"
TEST_PASSWORD = os.environ.get('TEST_USER_PASSWORD', 'TestPass123!')


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


# ----- Daily Rhythm -----
class TestDailyRhythm:
    def test_daily_rhythm_status(self, auth_headers):
        r = requests.get(f"{API}/premium/daily-rhythm", headers=auth_headers, timeout=30)
        assert r.status_code == 200, f"{r.status_code} {r.text}"

    def test_daily_rhythm_structure(self, auth_headers):
        r = requests.get(f"{API}/premium/daily-rhythm", headers=auth_headers, timeout=30)
        data = r.json()
        assert "rhythm" in data
        assert "cycle_day" in data
        assert "phase" in data
        assert "disclaimer" in data
        assert isinstance(data["disclaimer"], str) and len(data["disclaimer"]) > 0

    def test_daily_rhythm_has_8_categories(self, auth_headers):
        r = requests.get(f"{API}/premium/daily-rhythm", headers=auth_headers, timeout=30)
        rhythm = r.json()["rhythm"]
        for key in ["energy", "mood", "focus", "movement", "recovery", "self_care", "libido", "pain"]:
            assert key in rhythm, f"Missing category: {key}"
            item = rhythm[key]
            assert "level" in item and isinstance(item["level"], str)
            assert "score" in item and isinstance(item["score"], (int, float))
            assert 0 <= item["score"] <= 100
            assert "tip" in item and isinstance(item["tip"], str)

    def test_daily_rhythm_has_summary(self, auth_headers):
        r = requests.get(f"{API}/premium/daily-rhythm", headers=auth_headers, timeout=30)
        rhythm = r.json()["rhythm"]
        assert "summary" in rhythm and len(rhythm["summary"]) > 10

    def test_daily_rhythm_requires_auth(self):
        r = requests.get(f"{API}/premium/daily-rhythm", timeout=15)
        assert r.status_code in (401, 403)


# ----- Hormone Map -----
class TestHormoneMap:
    def test_hormone_map_status(self, auth_headers):
        r = requests.get(f"{API}/premium/hormone-map", headers=auth_headers, timeout=30)
        assert r.status_code == 200, f"{r.status_code} {r.text}"

    def test_hormone_map_structure(self, auth_headers):
        r = requests.get(f"{API}/premium/hormone-map", headers=auth_headers, timeout=30)
        data = r.json()
        assert "data" in data and isinstance(data["data"], list)
        assert "cycle_day" in data
        assert "cycle_length" in data
        assert "phase" in data
        assert "disclaimer" in data

    def test_hormone_map_28_data_points(self, auth_headers):
        r = requests.get(f"{API}/premium/hormone-map", headers=auth_headers, timeout=30)
        data = r.json()
        cycle_length = data["cycle_length"]
        assert len(data["data"]) == cycle_length
        # Default should be 28
        assert cycle_length >= 21 and cycle_length <= 45

    def test_hormone_map_point_fields(self, auth_headers):
        r = requests.get(f"{API}/premium/hormone-map", headers=auth_headers, timeout=30)
        points = r.json()["data"]
        for p in points:
            for field in ["day", "estrogen", "progesterone", "lh", "phase", "is_current"]:
                assert field in p, f"Missing {field} in {p}"
            assert 0 <= p["estrogen"] <= 100
            assert 0 <= p["progesterone"] <= 100
            assert 0 <= p["lh"] <= 100
            assert p["phase"] in ["Menstrual", "Follicular", "Ovulatory", "Luteal"]

    def test_hormone_map_phase_labels(self, auth_headers):
        r = requests.get(f"{API}/premium/hormone-map", headers=auth_headers, timeout=30)
        points = r.json()["data"]
        # Days 1-5 must be Menstrual
        for p in points[:5]:
            assert p["phase"] == "Menstrual", f"Day {p['day']} should be Menstrual, got {p['phase']}"
        # Must have all 4 phase labels
        labels = {p["phase"] for p in points}
        assert labels == {"Menstrual", "Follicular", "Ovulatory", "Luteal"}

    def test_hormone_map_today_marker(self, auth_headers):
        r = requests.get(f"{API}/premium/hormone-map", headers=auth_headers, timeout=30)
        data = r.json()
        current = [p for p in data["data"] if p["is_current"]]
        assert len(current) == 1, f"Expected exactly one is_current=True, got {len(current)}"
        assert current[0]["day"] == data["cycle_day"] or current[0]["day"] == min(data["cycle_day"], data["cycle_length"])

    def test_hormone_map_requires_auth(self):
        r = requests.get(f"{API}/premium/hormone-map", timeout=15)
        assert r.status_code in (401, 403)

"""
HORMOscope - Mood Prediction & New Features Tests
Tests for: mood prediction with relationship advice, profile photo upload, calendar expected period
"""
import pytest
import requests
import os
import uuid
import base64
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials provided
TEST_EMAIL = "luxtest3@example.com"
TEST_PASSWORD = os.environ.get('TEST_USER_PASSWORD', 'TestPass123!')


class TestMoodPrediction:
    """Mood Prediction Feature Tests - Most Important New Feature"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_dashboard_returns_mood_prediction(self):
        """Test dashboard includes mood_prediction object"""
        response = requests.get(f"{BASE_URL}/api/dashboard", headers=self.headers)
        assert response.status_code == 200, f"Dashboard failed: {response.text}"
        data = response.json()
        
        assert "mood_prediction" in data, "mood_prediction missing from dashboard"
        mood = data["mood_prediction"]
        
        # Verify all required fields exist
        required_fields = [
            "mood", "mood_score", "relationship_advice", "communication_warning",
            "good_for_serious_talks", "conflict_risk", "best_activities",
            "avoid_activities", "partner_tip"
        ]
        for field in required_fields:
            assert field in mood, f"Missing field: {field}"
        
        print(f"SUCCESS: mood_prediction contains all required fields")
    
    def test_mood_prediction_mood_field(self):
        """Test mood field returns descriptive mood string"""
        response = requests.get(f"{BASE_URL}/api/dashboard", headers=self.headers)
        data = response.json()
        mood = data["mood_prediction"]
        
        assert isinstance(mood["mood"], str)
        assert len(mood["mood"]) > 0
        
        # Valid moods based on phases
        valid_moods = [
            "Reflective & Introspective",
            "Optimistic & Energized", 
            "Confident & Magnetic",
            "Sensitive & Emotional"
        ]
        assert mood["mood"] in valid_moods, f"Unexpected mood: {mood['mood']}"
        print(f"SUCCESS: mood = '{mood['mood']}'")
    
    def test_mood_prediction_mood_score(self):
        """Test mood_score is 0-100 integer"""
        response = requests.get(f"{BASE_URL}/api/dashboard", headers=self.headers)
        data = response.json()
        mood = data["mood_prediction"]
        
        assert isinstance(mood["mood_score"], (int, float))
        assert 0 <= mood["mood_score"] <= 100, f"mood_score out of range: {mood['mood_score']}"
        print(f"SUCCESS: mood_score = {mood['mood_score']}")
    
    def test_mood_prediction_relationship_advice(self):
        """Test relationship_advice contains actionable advice"""
        response = requests.get(f"{BASE_URL}/api/dashboard", headers=self.headers)
        data = response.json()
        mood = data["mood_prediction"]
        
        assert isinstance(mood["relationship_advice"], str)
        assert len(mood["relationship_advice"]) > 20, "relationship_advice too short"
        
        # Should contain keywords about conversations/talks
        advice_lower = mood["relationship_advice"].lower()
        assert any(word in advice_lower for word in ["talk", "conversation", "day", "time"]), \
            "relationship_advice should mention talks/conversations"
        print(f"SUCCESS: relationship_advice = '{mood['relationship_advice'][:80]}...'")
    
    def test_mood_prediction_communication_warning(self):
        """Test communication_warning provides guidance"""
        response = requests.get(f"{BASE_URL}/api/dashboard", headers=self.headers)
        data = response.json()
        mood = data["mood_prediction"]
        
        assert isinstance(mood["communication_warning"], str)
        assert len(mood["communication_warning"]) > 10
        print(f"SUCCESS: communication_warning = '{mood['communication_warning'][:60]}...'")
    
    def test_mood_prediction_good_for_serious_talks(self):
        """Test good_for_serious_talks is boolean"""
        response = requests.get(f"{BASE_URL}/api/dashboard", headers=self.headers)
        data = response.json()
        mood = data["mood_prediction"]
        
        assert isinstance(mood["good_for_serious_talks"], bool)
        print(f"SUCCESS: good_for_serious_talks = {mood['good_for_serious_talks']}")
    
    def test_mood_prediction_conflict_risk(self):
        """Test conflict_risk is low/medium/high"""
        response = requests.get(f"{BASE_URL}/api/dashboard", headers=self.headers)
        data = response.json()
        mood = data["mood_prediction"]
        
        assert mood["conflict_risk"] in ["low", "medium", "high"], \
            f"Invalid conflict_risk: {mood['conflict_risk']}"
        print(f"SUCCESS: conflict_risk = '{mood['conflict_risk']}'")
    
    def test_mood_prediction_best_activities(self):
        """Test best_activities is non-empty list"""
        response = requests.get(f"{BASE_URL}/api/dashboard", headers=self.headers)
        data = response.json()
        mood = data["mood_prediction"]
        
        assert isinstance(mood["best_activities"], list)
        assert len(mood["best_activities"]) > 0
        for activity in mood["best_activities"]:
            assert isinstance(activity, str)
        print(f"SUCCESS: best_activities = {mood['best_activities']}")
    
    def test_mood_prediction_avoid_activities(self):
        """Test avoid_activities is non-empty list"""
        response = requests.get(f"{BASE_URL}/api/dashboard", headers=self.headers)
        data = response.json()
        mood = data["mood_prediction"]
        
        assert isinstance(mood["avoid_activities"], list)
        assert len(mood["avoid_activities"]) > 0
        for activity in mood["avoid_activities"]:
            assert isinstance(activity, str)
        print(f"SUCCESS: avoid_activities = {mood['avoid_activities']}")
    
    def test_mood_prediction_partner_tip(self):
        """Test partner_tip provides relationship guidance"""
        response = requests.get(f"{BASE_URL}/api/dashboard", headers=self.headers)
        data = response.json()
        mood = data["mood_prediction"]
        
        assert isinstance(mood["partner_tip"], str)
        assert len(mood["partner_tip"]) > 10
        print(f"SUCCESS: partner_tip = '{mood['partner_tip']}'")


class TestProfilePhotoUpload:
    """Profile Photo Upload Feature Tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_profile_photo_upload_endpoint_exists(self):
        """Test /api/profile/photo endpoint accepts POST"""
        # Create minimal PNG (1x1 pixel)
        png_data = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        )
        
        files = {"file": ("test.png", png_data, "image/png")}
        response = requests.post(
            f"{BASE_URL}/api/profile/photo",
            headers=self.headers,
            files=files
        )
        
        assert response.status_code == 200, f"Photo upload failed: {response.text}"
        data = response.json()
        assert "profile_photo" in data
        print("SUCCESS: Profile photo upload endpoint works")
    
    def test_profile_photo_returns_base64_data_url(self):
        """Test uploaded photo returns as base64 data URL"""
        png_data = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        )
        
        files = {"file": ("test.png", png_data, "image/png")}
        response = requests.post(
            f"{BASE_URL}/api/profile/photo",
            headers=self.headers,
            files=files
        )
        
        data = response.json()
        photo_url = data["profile_photo"]
        
        # Verify it's a data URL
        assert photo_url.startswith("data:image/"), "Photo should be data URL"
        assert ";base64," in photo_url, "Photo should be base64 encoded"
        print(f"SUCCESS: Photo returned as data URL: {photo_url[:50]}...")
    
    def test_profile_photo_persists_in_user(self):
        """Test uploaded photo is saved to user profile"""
        png_data = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        )
        
        files = {"file": ("test.png", png_data, "image/png")}
        upload_response = requests.post(
            f"{BASE_URL}/api/profile/photo",
            headers=self.headers,
            files=files
        )
        assert upload_response.status_code == 200
        
        # Verify by fetching user
        me_response = requests.get(f"{BASE_URL}/api/auth/me", headers=self.headers)
        assert me_response.status_code == 200
        user = me_response.json()
        
        assert user.get("profile_photo") is not None, "profile_photo not saved"
        assert user["profile_photo"].startswith("data:image/")
        print("SUCCESS: Profile photo persisted in user data")


class TestCalendarExpectedPeriod:
    """Calendar Expected Period Feature Tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_dashboard_returns_next_period_date(self):
        """Test dashboard cycle_info includes next_period_date"""
        response = requests.get(f"{BASE_URL}/api/dashboard", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "cycle_info" in data
        cycle_info = data["cycle_info"]
        
        assert "next_period_date" in cycle_info, "next_period_date missing"
        next_period = cycle_info["next_period_date"]
        
        # Should be a valid date string
        assert next_period is not None
        # Validate date format YYYY-MM-DD
        try:
            datetime.strptime(next_period, "%Y-%m-%d")
        except ValueError:
            pytest.fail(f"Invalid date format: {next_period}")
        
        print(f"SUCCESS: next_period_date = {next_period}")
    
    def test_next_period_date_is_future(self):
        """Test next_period_date is in the future or today"""
        response = requests.get(f"{BASE_URL}/api/dashboard", headers=self.headers)
        data = response.json()
        
        next_period_str = data["cycle_info"]["next_period_date"]
        next_period = datetime.strptime(next_period_str, "%Y-%m-%d").date()
        today = datetime.now().date()
        
        # Next period should be today or in the future
        assert next_period >= today, f"next_period_date {next_period} is in the past"
        print(f"SUCCESS: next_period_date {next_period} is >= today {today}")
    
    def test_days_until_period_matches_next_period_date(self):
        """Test days_until_period is consistent with next_period_date"""
        response = requests.get(f"{BASE_URL}/api/dashboard", headers=self.headers)
        data = response.json()
        cycle_info = data["cycle_info"]
        
        next_period_str = cycle_info["next_period_date"]
        days_until = cycle_info["days_until_period"]
        
        next_period = datetime.strptime(next_period_str, "%Y-%m-%d").date()
        today = datetime.now().date()
        expected_days = (next_period - today).days
        
        # Allow 1 day tolerance for timezone differences
        assert abs(days_until - expected_days) <= 1, \
            f"days_until_period ({days_until}) doesn't match calculated ({expected_days})"
        print(f"SUCCESS: days_until_period ({days_until}) matches next_period_date calculation")


class TestMoodPredictionByPhase:
    """Test mood prediction varies correctly by cycle phase"""
    
    def test_mood_prediction_structure_complete(self):
        """Verify mood prediction has all expected fields for any phase"""
        # Login
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get dashboard
        dashboard_res = requests.get(f"{BASE_URL}/api/dashboard", headers=headers)
        data = dashboard_res.json()
        mood = data["mood_prediction"]
        
        # Full structure check
        expected_structure = {
            "mood": str,
            "mood_score": (int, float),
            "emotional_state": str,
            "relationship_advice": str,
            "communication_warning": str,
            "best_activities": list,
            "avoid_activities": list,
            "partner_tip": str,
            "good_for_serious_talks": bool,
            "conflict_risk": str,
            "best_talk_days": str
        }
        
        for field, expected_type in expected_structure.items():
            assert field in mood, f"Missing field: {field}"
            assert isinstance(mood[field], expected_type), \
                f"Field {field} has wrong type: {type(mood[field])} (expected {expected_type})"
        
        print("SUCCESS: Mood prediction has complete structure with correct types")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

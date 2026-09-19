"""
HORMOscope API Tests
Tests for: health check, signup, onboarding (with birthday), dashboard (hormone levels, foods), profile notifications
"""
import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test user credentials
TEST_EMAIL = f"test_{uuid.uuid4().hex[:8]}@example.com"
TEST_PASSWORD = os.environ.get('TEST_USER_PASSWORD', 'TestPass123!')
TEST_NAME = "Test User"
TEST_BIRTHDAY = "1995-06-15"  # Birthday for testing
TEST_CYCLE_LENGTH = 28
TEST_LAST_PERIOD = (datetime.now() - timedelta(days=10)).strftime("%Y-%m-%d")


class TestHealthCheck:
    """API Health Check Tests"""
    
    def test_api_root_endpoint(self):
        """Test /api/ returns correct response"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "horMoscope" in data["message"]
        print(f"SUCCESS: API root returns: {data['message']}")


class TestUserSignup:
    """User Signup Flow Tests"""
    
    def test_signup_creates_user(self):
        """Test user signup creates new user and returns token"""
        response = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "name": TEST_NAME
        })
        assert response.status_code == 200, f"Signup failed: {response.text}"
        data = response.json()
        
        # Verify token returned
        assert "access_token" in data
        assert len(data["access_token"]) > 0
        
        # Verify user data
        assert "user" in data
        user = data["user"]
        assert user["email"] == TEST_EMAIL
        assert user["name"] == TEST_NAME
        assert not user["onboarding_complete"]
        assert "id" in user
        
        print(f"SUCCESS: User created with ID: {user['id']}")
        
        # Store for other tests
        pytest.test_token = data["access_token"]
        pytest.test_user_id = user["id"]
    
    def test_signup_duplicate_email_fails(self):
        """Test signup with existing email returns 400"""
        response = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 400
        data = response.json()
        assert "already registered" in data.get("detail", "").lower()
        print("SUCCESS: Duplicate email correctly rejected")


class TestOnboardingFlow:
    """Onboarding Flow Tests - 4 steps: name, birthday, cycle length, last period"""
    
    def test_onboarding_with_birthday(self):
        """Test onboarding collects birthday and all required fields"""
        token = getattr(pytest, 'test_token', None)
        if not token:
            pytest.skip("No token available - signup test may have failed")
        
        response = requests.post(f"{BASE_URL}/api/onboarding", 
            json={
                "name": TEST_NAME,
                "birthday": TEST_BIRTHDAY,
                "cycle_length": TEST_CYCLE_LENGTH,
                "last_period_date": TEST_LAST_PERIOD
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Onboarding failed: {response.text}"
        data = response.json()
        
        # Verify all fields saved
        assert data["name"] == TEST_NAME
        assert data["birthday"] == TEST_BIRTHDAY
        assert data["cycle_length"] == TEST_CYCLE_LENGTH
        assert data["last_period_date"] == TEST_LAST_PERIOD
        assert data["onboarding_complete"]
        
        # Verify age calculated from birthday
        assert "age" in data
        assert data["age"] > 0
        
        # Verify can_use_boyfriend_mode based on age (18+)
        assert "can_use_boyfriend_mode" in data
        expected_age = datetime.now().year - 1995
        if expected_age >= 18:
            assert data["can_use_boyfriend_mode"]
        
        print(f"SUCCESS: Onboarding complete - Birthday: {data['birthday']}, Age: {data['age']}, BF Mode: {data['can_use_boyfriend_mode']}")
    
    def test_onboarding_not_sure_cycle_length(self):
        """Test 'not sure' option defaults cycle length to 31"""
        # Create new user for this test
        new_email = f"test_notsure_{uuid.uuid4().hex[:8]}@example.com"
        signup_res = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "email": new_email,
            "password": TEST_PASSWORD
        })
        assert signup_res.status_code == 200
        token = signup_res.json()["access_token"]
        
        # Complete onboarding with cycle_length=31 (not sure default)
        response = requests.post(f"{BASE_URL}/api/onboarding",
            json={
                "name": "Not Sure User",
                "birthday": "2000-01-01",
                "cycle_length": 31,  # Default when user clicks "not sure"
                "last_period_date": TEST_LAST_PERIOD
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["cycle_length"] == 31
        print("SUCCESS: 'Not sure' cycle length defaults to 31 days")


class TestDashboardEndpoint:
    """Dashboard Endpoint Tests - New fields: hormone levels, foods, birthday banner"""
    
    def test_dashboard_returns_hormone_levels(self):
        """Test dashboard returns estrogen_level, progesterone_level, energy_level, pain_threshold"""
        token = getattr(pytest, 'test_token', None)
        if not token:
            pytest.skip("No token available")
        
        response = requests.get(f"{BASE_URL}/api/dashboard",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Dashboard failed: {response.text}"
        data = response.json()
        
        # Verify cycle_info contains hormone levels
        assert "cycle_info" in data
        cycle_info = data["cycle_info"]
        
        assert "estrogen_level" in cycle_info
        assert isinstance(cycle_info["estrogen_level"], (int, float))
        assert 0 <= cycle_info["estrogen_level"] <= 100
        
        assert "progesterone_level" in cycle_info
        assert isinstance(cycle_info["progesterone_level"], (int, float))
        assert 0 <= cycle_info["progesterone_level"] <= 100
        
        assert "energy_level" in cycle_info
        assert isinstance(cycle_info["energy_level"], (int, float))
        assert 0 <= cycle_info["energy_level"] <= 100
        
        assert "pain_threshold" in cycle_info
        assert isinstance(cycle_info["pain_threshold"], (int, float))
        assert 0 <= cycle_info["pain_threshold"] <= 100
        
        print(f"SUCCESS: Hormone levels - Estrogen: {cycle_info['estrogen_level']}%, Progesterone: {cycle_info['progesterone_level']}%")
        print(f"SUCCESS: Energy: {cycle_info['energy_level']}%, Pain Threshold: {cycle_info['pain_threshold']}%")
    
    def test_dashboard_returns_foods(self):
        """Test dashboard returns foods_to_eat and foods_to_avoid arrays"""
        token = getattr(pytest, 'test_token', None)
        if not token:
            pytest.skip("No token available")
        
        response = requests.get(f"{BASE_URL}/api/dashboard",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify foods arrays
        assert "foods_to_eat" in data
        assert isinstance(data["foods_to_eat"], list)
        assert len(data["foods_to_eat"]) > 0
        
        assert "foods_to_avoid" in data
        assert isinstance(data["foods_to_avoid"], list)
        assert len(data["foods_to_avoid"]) > 0
        
        print(f"SUCCESS: Foods to eat: {data['foods_to_eat']}")
        print(f"SUCCESS: Foods to avoid: {data['foods_to_avoid']}")
    
    def test_dashboard_returns_birthday_flag(self):
        """Test dashboard returns is_birthday flag"""
        token = getattr(pytest, 'test_token', None)
        if not token:
            pytest.skip("No token available")
        
        response = requests.get(f"{BASE_URL}/api/dashboard",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify is_birthday field exists
        assert "is_birthday" in data
        assert isinstance(data["is_birthday"], bool)
        
        # Since test birthday is June 15, it should be False unless today is June 15
        today = datetime.now()
        expected_birthday = (today.month == 6 and today.day == 15)
        assert data["is_birthday"] == expected_birthday
        
        print(f"SUCCESS: is_birthday flag: {data['is_birthday']}")
    
    def test_dashboard_returns_boyfriend_mode_flag(self):
        """Test dashboard returns can_use_boyfriend_mode based on age"""
        token = getattr(pytest, 'test_token', None)
        if not token:
            pytest.skip("No token available")
        
        response = requests.get(f"{BASE_URL}/api/dashboard",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify can_use_boyfriend_mode field
        assert "can_use_boyfriend_mode" in data
        assert isinstance(data["can_use_boyfriend_mode"], bool)
        
        # User born 1995 should be 18+ and have access
        assert data["can_use_boyfriend_mode"]
        
        print(f"SUCCESS: can_use_boyfriend_mode: {data['can_use_boyfriend_mode']}")
    
    def test_dashboard_returns_all_daily_content(self):
        """Test dashboard returns affirmation, nutrition_tip, wellness_tip"""
        token = getattr(pytest, 'test_token', None)
        if not token:
            pytest.skip("No token available")
        
        response = requests.get(f"{BASE_URL}/api/dashboard",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify daily content
        assert "affirmation" in data
        assert len(data["affirmation"]) > 0
        
        assert "nutrition_tip" in data
        assert len(data["nutrition_tip"]) > 0
        
        assert "wellness_tip" in data
        assert len(data["wellness_tip"]) > 0
        
        print(f"SUCCESS: Affirmation: {data['affirmation'][:50]}...")
        print(f"SUCCESS: Nutrition tip: {data['nutrition_tip'][:50]}...")


class TestProfileNotificationToggle:
    """Profile Notification Toggle Tests - Should save immediately without edit mode"""
    
    def test_notification_toggle_saves_immediately(self):
        """Test notification preferences save immediately via PUT /profile"""
        token = getattr(pytest, 'test_token', None)
        if not token:
            pytest.skip("No token available")
        
        # First, get current preferences
        me_response = requests.get(f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert me_response.status_code == 200
        initial_prefs = me_response.json().get("notification_preferences", {})
        
        # Toggle period_reminder to opposite value
        new_period_reminder = not initial_prefs.get("period_reminder", True)
        
        # Update just notification preferences (no edit mode needed)
        response = requests.put(f"{BASE_URL}/api/profile",
            json={
                "notification_preferences": {
                    "period_reminder": new_period_reminder,
                    "daily_tips": initial_prefs.get("daily_tips", True)
                }
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Profile update failed: {response.text}"
        data = response.json()
        
        # Verify notification preference was updated
        assert data["notification_preferences"]["period_reminder"] == new_period_reminder
        
        # Verify by fetching user again
        verify_response = requests.get(f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert verify_response.status_code == 200
        verify_data = verify_response.json()
        assert verify_data["notification_preferences"]["period_reminder"] == new_period_reminder
        
        print(f"SUCCESS: Notification toggle saved immediately - period_reminder: {new_period_reminder}")
    
    def test_toggle_daily_tips_notification(self):
        """Test daily_tips notification toggle saves immediately"""
        token = getattr(pytest, 'test_token', None)
        if not token:
            pytest.skip("No token available")
        
        # Get current preferences
        me_response = requests.get(f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        initial_prefs = me_response.json().get("notification_preferences", {})
        
        # Toggle daily_tips
        new_daily_tips = not initial_prefs.get("daily_tips", True)
        
        response = requests.put(f"{BASE_URL}/api/profile",
            json={
                "notification_preferences": {
                    "period_reminder": initial_prefs.get("period_reminder", True),
                    "daily_tips": new_daily_tips
                }
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["notification_preferences"]["daily_tips"] == new_daily_tips
        
        print(f"SUCCESS: Daily tips toggle saved immediately - daily_tips: {new_daily_tips}")


class TestUnderageBoyfriendMode:
    """Test that underage users cannot use boyfriend mode"""
    
    def test_underage_user_cannot_use_boyfriend_mode(self):
        """Test user under 18 has can_use_boyfriend_mode=False"""
        # Create new user
        new_email = f"test_underage_{uuid.uuid4().hex[:8]}@example.com"
        signup_res = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "email": new_email,
            "password": TEST_PASSWORD
        })
        assert signup_res.status_code == 200
        token = signup_res.json()["access_token"]
        
        # Complete onboarding with underage birthday (15 years old)
        underage_birthday = (datetime.now() - timedelta(days=15*365)).strftime("%Y-%m-%d")
        
        response = requests.post(f"{BASE_URL}/api/onboarding",
            json={
                "name": "Teen User",
                "birthday": underage_birthday,
                "cycle_length": 28,
                "last_period_date": TEST_LAST_PERIOD
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify can_use_boyfriend_mode is False for underage
        assert not data["can_use_boyfriend_mode"]
        
        # Also verify in dashboard
        dashboard_res = requests.get(f"{BASE_URL}/api/dashboard",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert dashboard_res.status_code == 200
        dashboard_data = dashboard_res.json()
        assert not dashboard_data["can_use_boyfriend_mode"]
        
        print("SUCCESS: Underage user correctly blocked from boyfriend mode")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

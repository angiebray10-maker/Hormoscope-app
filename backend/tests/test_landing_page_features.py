"""
Test Suite for horMoscope Landing Page Features
Tests the new landing page implementation including:
- Lead capture endpoint
- Auth endpoints (signup, login)
- Onboarding flow
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestLeadCaptureEndpoint:
    """Tests for POST /api/lead-capture endpoint"""
    
    def test_lead_capture_valid_email(self):
        """Test lead capture with valid email - should return success"""
        unique_email = f"lead-test-{int(time.time())}@example.com"
        response = requests.post(f"{BASE_URL}/api/lead-capture", json={
            "email": unique_email,
            "lead_type": "cycle_guide"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert "message" in data
        print(f"✓ Lead capture for {unique_email} successful: {data['message']}")
    
    def test_lead_capture_duplicate_email(self):
        """Test lead capture with duplicate email - should still return success (updates existing)"""
        test_email = "duplicate-lead-test@example.com"
        
        # First submission
        response1 = requests.post(f"{BASE_URL}/api/lead-capture", json={
            "email": test_email,
            "lead_type": "cycle_guide"
        })
        assert response1.status_code == 200
        
        # Second submission with same email (should update, not fail)
        response2 = requests.post(f"{BASE_URL}/api/lead-capture", json={
            "email": test_email,
            "lead_type": "notifications"
        })
        assert response2.status_code == 200
        data = response2.json()
        assert data["success"]
        print(f"✓ Duplicate lead capture handled correctly")
    
    def test_lead_capture_invalid_email(self):
        """Test lead capture with invalid email - should return 422 validation error"""
        response = requests.post(f"{BASE_URL}/api/lead-capture", json={
            "email": "not-an-email",
            "lead_type": "cycle_guide"
        })
        
        # Pydantic validation should return 422 for invalid email
        assert response.status_code == 422
        print(f"✓ Invalid email correctly rejected with 422")
    
    def test_lead_capture_missing_email(self):
        """Test lead capture without email - should return 422"""
        response = requests.post(f"{BASE_URL}/api/lead-capture", json={
            "lead_type": "cycle_guide"
        })
        
        assert response.status_code == 422
        print(f"✓ Missing email correctly rejected with 422")


class TestAuthEndpoints:
    """Tests for authentication endpoints"""
    
    def test_signup_creates_user(self):
        """Test signup creates a new user and returns token"""
        unique_email = f"test-signup-{int(time.time())}@example.com"
        response = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "email": unique_email,
            "password": "TestPass123!"
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == unique_email
        assert not data["user"]["onboarding_complete"]
        assert len(data["access_token"]) > 0
        print(f"✓ Signup successful for {unique_email}")
        
        return data["access_token"], unique_email
    
    def test_signup_duplicate_email(self):
        """Test signup with existing email returns error"""
        # Create first user
        unique_email = f"test-dup-{int(time.time())}@example.com"
        response1 = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "email": unique_email,
            "password": "TestPass123!"
        })
        assert response1.status_code == 200
        
        # Try to create with same email
        response2 = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "email": unique_email,
            "password": "DifferentPass123!"
        })
        assert response2.status_code == 400
        data = response2.json()
        assert "already registered" in data["detail"].lower() or "email" in data["detail"].lower()
        print(f"✓ Duplicate signup correctly rejected")
    
    def test_login_valid_credentials(self):
        """Test login with valid credentials"""
        # Create user first
        unique_email = f"test-login-{int(time.time())}@example.com"
        password = os.environ.get('TEST_LOGIN_PASSWORD', 'TestLogin123!')
        
        signup_response = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "email": unique_email,
            "password": password
        })
        assert signup_response.status_code == 200
        
        # Login
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": unique_email,
            "password": password
        })
        
        assert login_response.status_code == 200
        data = login_response.json()
        assert "access_token" in data
        assert data["user"]["email"] == unique_email
        print(f"✓ Login successful for {unique_email}")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid password"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "nonexistent@example.com",
            "password": "wrongpassword"
        })
        
        assert response.status_code == 401
        data = response.json()
        assert "invalid" in data["detail"].lower() or "credentials" in data["detail"].lower()
        print(f"✓ Invalid login correctly rejected")
    
    def test_auth_me_endpoint(self):
        """Test GET /api/auth/me returns user info with valid token"""
        # Create user and get token
        unique_email = f"test-me-{int(time.time())}@example.com"
        signup_response = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "email": unique_email,
            "password": "TestMe123!"
        })
        token = signup_response.json()["access_token"]
        
        # Call /me endpoint
        me_response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {token}"
        })
        
        assert me_response.status_code == 200
        data = me_response.json()
        assert data["email"] == unique_email
        print(f"✓ GET /api/auth/me returns correct user")
    
    def test_auth_me_without_token(self):
        """Test GET /api/auth/me without token returns 403"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        
        assert response.status_code == 403
        print(f"✓ Unauthenticated /me request correctly rejected")


class TestOnboardingEndpoint:
    """Tests for onboarding endpoint"""
    
    def test_onboarding_completes_profile(self):
        """Test onboarding endpoint updates user profile"""
        # Create user
        unique_email = f"test-onboard-{int(time.time())}@example.com"
        signup_response = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "email": unique_email,
            "password": "TestOnboard123!"
        })
        token = signup_response.json()["access_token"]
        
        # Complete onboarding
        onboard_response = requests.post(f"{BASE_URL}/api/onboarding", 
            headers={"Authorization": f"Bearer {token}"},
            json={
                "name": "Test User",
                "birthday": "1995-05-15",
                "cycle_length": 28,
                "last_period_date": "2026-02-20",
                "notifications_enabled": True,
                "notification_time": "09:00"
            }
        )
        
        assert onboard_response.status_code == 200
        data = onboard_response.json()
        assert data["name"] == "Test User"
        assert data["onboarding_complete"]
        assert data["cycle_length"] == 28
        print(f"✓ Onboarding completed successfully")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

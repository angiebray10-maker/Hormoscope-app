"""
Test suite for HORMOscope new features:
1. Camera/Image upload in Boyfriend Mode (Claude Sonnet 4.5 vision)
2. Daily content caching (mood, wellness tip, nutrition, do/avoid activities)
3. Chat functionality in both AI coach and Boyfriend mode
4. Conversation history persistence
"""

import pytest
import requests
import os
import base64
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://hormone-hub-1.preview.emergentagent.com').rstrip('/')

# Test credentials
PREMIUM_USER_EMAIL = "premium_test@hormoscope.com"
PREMIUM_USER_PASSWORD = os.environ.get('TEST_PREMIUM_PASSWORD', 'TestPremium123!')

# Simple test image (1x1 red pixel PNG)
TEST_IMAGE_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="


class TestAuth:
    """Authentication tests"""
    
    def test_login_premium_user(self):
        """Test login with premium user credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PREMIUM_USER_EMAIL,
            "password": PREMIUM_USER_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["is_premium"]
        assert data["user"]["can_use_boyfriend_mode"]
        print(f"SUCCESS: Premium user login - is_premium={data['user']['is_premium']}")
        return data["access_token"]


class TestCameraFeature:
    """Camera/Image upload feature tests - Boyfriend Mode only"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for premium user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PREMIUM_USER_EMAIL,
            "password": PREMIUM_USER_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_image_upload_in_boyfriend_mode(self, auth_token):
        """Test sending image in Boyfriend Mode - should work for premium users"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Send image with message in boyfriend mode
        response = requests.post(f"{BASE_URL}/api/chat", json={
            "message": "What do you think of this?",
            "is_boyfriend_mode": True,
            "image_base64": f"data:image/png;base64,{TEST_IMAGE_BASE64}"
        }, headers=headers)
        
        assert response.status_code == 200, f"Image upload failed: {response.text}"
        data = response.json()
        assert "ai_response" in data
        assert data["is_boyfriend_mode"]
        assert data["has_image"]
        assert data["conversation_id"] is not None
        print(f"SUCCESS: Image upload in Boyfriend Mode - has_image={data['has_image']}")
        print(f"AI Response preview: {data['ai_response'][:100]}...")
        return data["conversation_id"]
    
    def test_image_upload_without_text(self, auth_token):
        """Test sending image without text message in Boyfriend Mode"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.post(f"{BASE_URL}/api/chat", json={
            "message": "",
            "is_boyfriend_mode": True,
            "image_base64": f"data:image/png;base64,{TEST_IMAGE_BASE64}"
        }, headers=headers)
        
        assert response.status_code == 200, f"Image-only upload failed: {response.text}"
        data = response.json()
        assert data["has_image"]
        assert data["user_message"] == "[Photo]"
        print(f"SUCCESS: Image-only upload in Boyfriend Mode")
    
    def test_image_blocked_in_coach_mode(self, auth_token):
        """Test that image upload is blocked in regular AI coach mode"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.post(f"{BASE_URL}/api/chat", json={
            "message": "What do you think?",
            "is_boyfriend_mode": False,
            "image_base64": f"data:image/png;base64,{TEST_IMAGE_BASE64}"
        }, headers=headers)
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        data = response.json()
        assert "Image feature is only available in Boyfriend Mode" in data["detail"]
        print(f"SUCCESS: Image correctly blocked in AI coach mode")


class TestChatFunctionality:
    """Chat functionality tests for both modes"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for premium user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PREMIUM_USER_EMAIL,
            "password": PREMIUM_USER_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_chat_ai_coach_mode(self, auth_token):
        """Test sending message in AI coach mode"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.post(f"{BASE_URL}/api/chat", json={
            "message": "What foods should I eat during my follicular phase?",
            "is_boyfriend_mode": False
        }, headers=headers)
        
        assert response.status_code == 200, f"Chat failed: {response.text}"
        data = response.json()
        assert "ai_response" in data
        assert not data["is_boyfriend_mode"]
        assert len(data["ai_response"]) > 50  # Should have substantial response
        print(f"SUCCESS: AI coach mode chat works")
        print(f"Response preview: {data['ai_response'][:100]}...")
    
    def test_chat_boyfriend_mode(self, auth_token):
        """Test sending message in Boyfriend mode"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.post(f"{BASE_URL}/api/chat", json={
            "message": "Hey babe, how was your day?",
            "is_boyfriend_mode": True
        }, headers=headers)
        
        assert response.status_code == 200, f"Chat failed: {response.text}"
        data = response.json()
        assert "ai_response" in data
        assert data["is_boyfriend_mode"]
        assert len(data["ai_response"]) > 20
        print(f"SUCCESS: Boyfriend mode chat works")
        print(f"Response preview: {data['ai_response'][:100]}...")


class TestConversationHistory:
    """Conversation history and persistence tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for premium user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PREMIUM_USER_EMAIL,
            "password": PREMIUM_USER_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_conversation_list(self, auth_token):
        """Test fetching conversation list"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Get boyfriend mode conversations
        response = requests.get(f"{BASE_URL}/api/chat/conversations?is_boyfriend_mode=true", headers=headers)
        assert response.status_code == 200, f"Failed to get conversations: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"SUCCESS: Got {len(data)} boyfriend mode conversations")
        
        # Get AI coach conversations
        response = requests.get(f"{BASE_URL}/api/chat/conversations?is_boyfriend_mode=false", headers=headers)
        assert response.status_code == 200
        data = response.json()
        print(f"SUCCESS: Got {len(data)} AI coach conversations")
    
    def test_conversation_history_load(self, auth_token):
        """Test loading a specific conversation's history"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # First create a conversation
        response = requests.post(f"{BASE_URL}/api/chat", json={
            "message": "Test message for history",
            "is_boyfriend_mode": True
        }, headers=headers)
        assert response.status_code == 200
        conv_id = response.json()["conversation_id"]
        
        # Load the conversation history
        response = requests.get(f"{BASE_URL}/api/chat/history?conversation_id={conv_id}", headers=headers)
        assert response.status_code == 200, f"Failed to load history: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert data[0]["user_message"] == "Test message for history"
        print(f"SUCCESS: Conversation history loads correctly with {len(data)} messages")


class TestDailyContentCaching:
    """Daily content caching tests - content should stay same when navigating"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for premium user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PREMIUM_USER_EMAIL,
            "password": PREMIUM_USER_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_dashboard_content_consistency(self, auth_token):
        """Test that dashboard content stays the same across multiple requests"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # First request
        response1 = requests.get(f"{BASE_URL}/api/dashboard", headers=headers)
        assert response1.status_code == 200, f"Dashboard failed: {response1.text}"
        data1 = response1.json()
        
        # Second request (simulating navigation away and back)
        response2 = requests.get(f"{BASE_URL}/api/dashboard", headers=headers)
        assert response2.status_code == 200
        data2 = response2.json()
        
        # Third request
        response3 = requests.get(f"{BASE_URL}/api/dashboard", headers=headers)
        assert response3.status_code == 200
        data3 = response3.json()
        
        # Verify all content stays the same
        assert data1["affirmation"] == data2["affirmation"] == data3["affirmation"], "Affirmation changed!"
        assert data1["wellness_tip"] == data2["wellness_tip"] == data3["wellness_tip"], "Wellness tip changed!"
        assert data1["nutrition_tip"] == data2["nutrition_tip"] == data3["nutrition_tip"], "Nutrition tip changed!"
        assert data1["foods_to_eat"] == data2["foods_to_eat"] == data3["foods_to_eat"], "Foods to eat changed!"
        assert data1["foods_to_avoid"] == data2["foods_to_avoid"] == data3["foods_to_avoid"], "Foods to avoid changed!"
        
        # Verify mood prediction stays the same
        assert data1["mood_prediction"]["mood"] == data2["mood_prediction"]["mood"] == data3["mood_prediction"]["mood"], "Mood changed!"
        assert data1["mood_prediction"]["best_activities"] == data2["mood_prediction"]["best_activities"], "Best activities changed!"
        assert data1["mood_prediction"]["avoid_activities"] == data2["mood_prediction"]["avoid_activities"], "Avoid activities changed!"
        
        print(f"SUCCESS: All daily content stays consistent across 3 requests")
        print(f"  - Affirmation: {data1['affirmation'][:50]}...")
        print(f"  - Wellness tip: {data1['wellness_tip'][:50]}...")
        print(f"  - Mood: {data1['mood_prediction']['mood']}")
    
    def test_dashboard_has_all_required_fields(self, auth_token):
        """Test that dashboard returns all required daily content fields"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.get(f"{BASE_URL}/api/dashboard", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        # Check all required fields exist
        required_fields = [
            "affirmation", "wellness_tip", "nutrition_tip", 
            "foods_to_eat", "foods_to_avoid", "mood_prediction"
        ]
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        
        # Check mood_prediction structure
        mood = data["mood_prediction"]
        mood_fields = [
            "mood", "mood_score", "emotional_state", "relationship_advice",
            "best_activities", "avoid_activities", "partner_tip"
        ]
        for field in mood_fields:
            assert field in mood, f"Missing mood field: {field}"
        
        # Verify types
        assert isinstance(data["foods_to_eat"], list)
        assert isinstance(data["foods_to_avoid"], list)
        assert isinstance(mood["best_activities"], list)
        assert isinstance(mood["avoid_activities"], list)
        assert len(mood["best_activities"]) > 0
        assert len(mood["avoid_activities"]) > 0
        
        print(f"SUCCESS: Dashboard has all required fields")
        print(f"  - Foods to eat: {data['foods_to_eat']}")
        print(f"  - Foods to avoid: {data['foods_to_avoid']}")
        print(f"  - Best activities: {mood['best_activities']}")
        print(f"  - Avoid activities: {mood['avoid_activities']}")


class TestProfileSubscription:
    """Profile and subscription management tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for premium user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PREMIUM_USER_EMAIL,
            "password": PREMIUM_USER_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_user_profile_returns_premium_status(self, auth_token):
        """Test that user profile correctly shows premium status"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        assert data["is_premium"]
        assert data["can_use_boyfriend_mode"]
        print(f"SUCCESS: User profile shows premium status correctly")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

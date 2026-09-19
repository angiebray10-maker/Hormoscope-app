import requests
import sys
import json
from datetime import datetime, timedelta
import time

class HorMoscopeAPITester:
    def __init__(self, base_url="https://hormone-hub-1.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        
        # Test data
        self.test_email = f"test_{int(time.time())}@example.com"
        self.test_password = "TestPass123!"
        self.test_name = "Test User"

    def log_result(self, test_name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {test_name} - PASSED")
        else:
            print(f"❌ {test_name} - FAILED: {details}")
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details
        })

    def make_request(self, method, endpoint, data=None, expected_status=200):
        """Make API request with error handling"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            return success, response.json() if response.content else {}, response.status_code

        except Exception as e:
            return False, {"error": str(e)}, 0

    def test_auth_signup(self):
        """Test user signup"""
        success, response, status = self.make_request(
            'POST', 'auth/signup', 
            {
                "email": self.test_email,
                "password": self.test_password,
                "name": self.test_name
            },
            expected_status=200
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_id = response['user']['id']
            self.log_result("Auth Signup", True)
            return True
        else:
            self.log_result("Auth Signup", False, f"Status: {status}, Response: {response}")
            return False

    def test_auth_login(self):
        """Test user login"""
        success, response, status = self.make_request(
            'POST', 'auth/login',
            {
                "email": self.test_email,
                "password": self.test_password
            },
            expected_status=200
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.log_result("Auth Login", True)
            return True
        else:
            self.log_result("Auth Login", False, f"Status: {status}, Response: {response}")
            return False

    def test_auth_me(self):
        """Test get current user"""
        success, response, status = self.make_request('GET', 'auth/me')
        
        if success and 'email' in response:
            self.log_result("Auth Me", True)
            return True
        else:
            self.log_result("Auth Me", False, f"Status: {status}, Response: {response}")
            return False

    def test_onboarding(self):
        """Test onboarding completion"""
        last_period = (datetime.now() - timedelta(days=10)).strftime('%Y-%m-%d')
        
        success, response, status = self.make_request(
            'POST', 'onboarding',
            {
                "name": self.test_name,
                "cycle_length": 28,
                "last_period_date": last_period,
                "boyfriend_name": "TestBoy"
            },
            expected_status=200
        )
        
        if success and response.get('onboarding_complete'):
            self.log_result("Onboarding", True)
            return True
        else:
            self.log_result("Onboarding", False, f"Status: {status}, Response: {response}")
            return False

    def test_dashboard(self):
        """Test dashboard data"""
        success, response, status = self.make_request('GET', 'dashboard')
        
        if success and 'cycle_info' in response:
            self.log_result("Dashboard", True)
            return True
        else:
            self.log_result("Dashboard", False, f"Status: {status}, Response: {response}")
            return False

    def test_profile_update(self):
        """Test profile update"""
        success, response, status = self.make_request(
            'PUT', 'profile',
            {
                "name": "Updated Name",
                "boyfriend_name": "UpdatedBoy",
                "notification_preferences": {"period_reminder": False, "daily_tips": True}
            },
            expected_status=200
        )
        
        if success and response.get('name') == "Updated Name":
            self.log_result("Profile Update", True)
            return True
        else:
            self.log_result("Profile Update", False, f"Status: {status}, Response: {response}")
            return False

    def test_cycle_logs(self):
        """Test cycle logs CRUD"""
        # Create cycle log
        today = datetime.now().strftime('%Y-%m-%d')
        success, response, status = self.make_request(
            'POST', 'cycle-logs',
            {
                "date": today,
                "is_period": True,
                "flow": "medium",
                "symptoms": ["cramps", "bloating"],
                "notes": "Test period day"
            },
            expected_status=200
        )
        
        if not success:
            self.log_result("Cycle Logs Create", False, f"Status: {status}, Response: {response}")
            return False
        
        log_id = response.get('id')
        
        # Get cycle logs
        success, response, status = self.make_request('GET', 'cycle-logs')
        
        if success and isinstance(response, list):
            self.log_result("Cycle Logs Read", True)
            
            # Delete cycle log
            if log_id:
                success, _, status = self.make_request('DELETE', f'cycle-logs/{log_id}')
                self.log_result("Cycle Logs Delete", success, f"Status: {status}" if not success else "")
            
            return True
        else:
            self.log_result("Cycle Logs Read", False, f"Status: {status}, Response: {response}")
            return False

    def test_intimacy_logs_non_premium(self):
        """Test intimacy logs without premium (should fail)"""
        today = datetime.now().strftime('%Y-%m-%d')
        success, response, status = self.make_request(
            'POST', 'intimacy-logs',
            {"date": today, "notes": "Test intimacy"},
            expected_status=403
        )
        
        # Should fail with 403 for non-premium users
        if status == 403:
            self.log_result("Intimacy Logs Premium Gate", True)
            return True
        else:
            self.log_result("Intimacy Logs Premium Gate", False, f"Expected 403, got {status}")
            return False

    def test_ai_chat_wellness(self):
        """Test AI chat wellness mode"""
        success, response, status = self.make_request(
            'POST', 'chat',
            {
                "message": "How are my hormones today?",
                "is_boyfriend_mode": False
            },
            expected_status=200
        )
        
        if success and 'ai_response' in response:
            self.log_result("AI Chat Wellness", True)
            return True
        else:
            self.log_result("AI Chat Wellness", False, f"Status: {status}, Response: {response}")
            return False

    def test_ai_chat_boyfriend_non_premium(self):
        """Test AI chat boyfriend mode without premium (should fail)"""
        success, response, status = self.make_request(
            'POST', 'chat',
            {
                "message": "Hey babe, how are you?",
                "is_boyfriend_mode": True
            },
            expected_status=403
        )
        
        # Should fail with 403 for non-premium users
        if status == 403:
            self.log_result("AI Chat Boyfriend Premium Gate", True)
            return True
        else:
            self.log_result("AI Chat Boyfriend Premium Gate", False, f"Expected 403, got {status}")
            return False

    def test_chat_history(self):
        """Test chat history"""
        success, response, status = self.make_request('GET', 'chat/history?is_boyfriend_mode=false')
        
        if success and isinstance(response, list):
            self.log_result("Chat History", True)
            return True
        else:
            self.log_result("Chat History", False, f"Status: {status}, Response: {response}")
            return False

    def test_insights(self):
        """Test insights (FREE feature)"""
        success, response, status = self.make_request('GET', 'insights')
        
        if success and 'hormone_chart' in response:
            self.log_result("Insights", True)
            return True
        else:
            self.log_result("Insights", False, f"Status: {status}, Response: {response}")
            return False

    def test_subscription_checkout(self):
        """Test subscription checkout"""
        success, response, status = self.make_request(
            'POST', 'subscription/checkout',
            {
                "package_id": "premium_monthly",
                "origin_url": "https://hormone-hub-1.preview.emergentagent.com"
            },
            expected_status=200
        )
        
        if success and 'url' in response:
            self.log_result("Subscription Checkout", True)
            return True
        else:
            self.log_result("Subscription Checkout", False, f"Status: {status}, Response: {response}")
            return False

    def test_api_root(self):
        """Test API root endpoint"""
        success, response, status = self.make_request('GET', '')
        
        if success and 'message' in response:
            self.log_result("API Root", True)
            return True
        else:
            self.log_result("API Root", False, f"Status: {status}, Response: {response}")
            return False

    def run_all_tests(self):
        """Run all API tests"""
        print(f"🚀 Starting horMoscope API Tests")
        print(f"📍 Base URL: {self.base_url}")
        print("=" * 50)

        # Test API root
        self.test_api_root()

        # Test authentication flow
        if not self.test_auth_signup():
            print("❌ Signup failed, stopping tests")
            return self.get_summary()

        if not self.test_auth_me():
            print("❌ Auth verification failed")

        # Test onboarding
        if not self.test_onboarding():
            print("❌ Onboarding failed")

        # Test dashboard
        self.test_dashboard()

        # Test profile
        self.test_profile_update()

        # Test cycle logs
        self.test_cycle_logs()

        # Test premium gates (should fail for non-premium)
        self.test_intimacy_logs_non_premium()
        self.test_ai_chat_boyfriend_non_premium()

        # Test AI chat (wellness mode)
        self.test_ai_chat_wellness()

        # Test chat history
        self.test_chat_history()

        # Test insights (FREE)
        self.test_insights()

        # Test subscription
        self.test_subscription_checkout()

        # Test login with existing user
        self.test_auth_login()

        return self.get_summary()

    def get_summary(self):
        """Get test summary"""
        print("\n" + "=" * 50)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
        else:
            print("⚠️  Some tests failed")
            
        return {
            "total_tests": self.tests_run,
            "passed_tests": self.tests_passed,
            "success_rate": (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0,
            "results": self.test_results
        }

def main():
    tester = HorMoscopeAPITester()
    summary = tester.run_all_tests()
    
    # Return appropriate exit code
    return 0 if summary["success_rate"] == 100 else 1

if __name__ == "__main__":
    sys.exit(main())
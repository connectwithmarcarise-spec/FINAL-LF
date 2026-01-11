import requests
import sys
import json
from datetime import datetime

class CampusLostFoundTester:
    def __init__(self, base_url="https://findmine.preview.emergentagent.com"):
        self.base_url = base_url
        self.admin_token = None
        self.super_admin_token = None
        self.student_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None, files=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if headers:
            test_headers.update(headers)
        
        if self.admin_token and 'Authorization' not in test_headers:
            test_headers['Authorization'] = f'Bearer {self.admin_token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers)
            elif method == 'POST':
                if files:
                    # Remove Content-Type for file uploads
                    test_headers.pop('Content-Type', None)
                    response = requests.post(url, data=data, files=files, headers=test_headers)
                else:
                    response = requests.post(url, json=data, headers=test_headers)
            elif method == 'DELETE':
                response = requests.delete(url, json=data, headers=test_headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json() if response.content else {}
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}")
                self.failed_tests.append({
                    "test": name,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "response": response.text[:200]
                })
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({
                "test": name,
                "error": str(e)
            })
            return False, {}

    def test_health_check(self):
        """Test basic health endpoints"""
        print("\n=== HEALTH CHECK TESTS ===")
        self.run_test("API Root", "GET", "", 200)
        self.run_test("Health Check", "GET", "health", 200)

    def test_public_endpoints(self):
        """Test public endpoints that don't require authentication"""
        print("\n=== PUBLIC ENDPOINTS TESTS ===")
        self.run_test("Public Items", "GET", "items/public", 200)

    def test_admin_login(self):
        """Test admin login with super admin credentials"""
        print("\n=== ADMIN LOGIN TESTS ===")
        
        # Test super admin login
        success, response = self.run_test(
            "Super Admin Login",
            "POST",
            "auth/admin/login",
            200,
            data={"username": "superadmin", "password": "SuperAdmin@123"}
        )
        
        if success and 'token' in response:
            self.super_admin_token = response['token']
            self.admin_token = response['token']  # Use super admin token for admin operations
            print(f"   Super Admin Token: {self.super_admin_token[:20]}...")
            return True
        return False

    def test_admin_endpoints(self):
        """Test admin-only endpoints"""
        if not self.admin_token:
            print("❌ Skipping admin tests - no admin token")
            return
            
        print("\n=== ADMIN ENDPOINTS TESTS ===")
        
        # Test stats endpoint
        self.run_test("Admin Stats", "GET", "stats", 200)
        
        # Test students endpoint
        self.run_test("Get Students", "GET", "students", 200)
        
        # Test items with admin access
        self.run_test("Get All Items (Admin)", "GET", "items", 200)
        
        # Test lost items
        self.run_test("Get Lost Items", "GET", "items?item_type=lost", 200)
        
        # Test found items
        self.run_test("Get Found Items", "GET", "items?item_type=found", 200)
        
        # Test deleted items
        self.run_test("Get Deleted Items", "GET", "items/deleted/all", 200)
        
        # Test claims
        self.run_test("Get Claims", "GET", "claims", 200)
        
        # Test messages
        self.run_test("Get Messages", "GET", "messages", 200)
        
        # Test AI matches
        self.run_test("Get AI Matches", "GET", "ai/matches", 200)

    def test_super_admin_endpoints(self):
        """Test super admin specific endpoints"""
        if not self.super_admin_token:
            print("❌ Skipping super admin tests - no super admin token")
            return
            
        print("\n=== SUPER ADMIN ENDPOINTS TESTS ===")
        
        headers = {'Authorization': f'Bearer {self.super_admin_token}'}
        
        # Test get admins
        self.run_test("Get Admins", "GET", "admins", 200, headers=headers)

    def test_student_excel_upload(self):
        """Test student Excel upload functionality"""
        if not self.admin_token:
            print("❌ Skipping Excel upload test - no admin token")
            return
            
        print("\n=== STUDENT EXCEL UPLOAD TEST ===")
        
        # Create a simple CSV content for testing (Excel upload expects specific format)
        csv_content = """Roll Number,Full Name,Department,Year,DOB,Email,Phone Number
TEST001,Test Student,Computer Science,2024,2000-01-01,test@example.com,1234567890"""
        
        # Note: This test might fail if the endpoint expects actual Excel format
        # but it will test the endpoint accessibility
        headers = {'Authorization': f'Bearer {self.admin_token}'}
        files = {'file': ('test_students.csv', csv_content, 'text/csv')}
        
        self.run_test(
            "Upload Students Excel", 
            "POST", 
            "students/upload-excel", 
            400,  # Expecting 400 because CSV instead of Excel
            files=files,
            headers=headers
        )

    def test_authentication_flow(self):
        """Test authentication and authorization"""
        print("\n=== AUTHENTICATION TESTS ===")
        
        # Test invalid admin login
        self.run_test(
            "Invalid Admin Login",
            "POST",
            "auth/admin/login",
            401,
            data={"username": "invalid", "password": "invalid"}
        )
        
        # Test /auth/me endpoint with admin token
        if self.admin_token:
            headers = {'Authorization': f'Bearer {self.admin_token}'}
            self.run_test("Get Current User (Admin)", "GET", "auth/me", 200, headers=headers)

    def print_summary(self):
        """Print test summary"""
        print(f"\n{'='*50}")
        print(f"📊 TEST SUMMARY")
        print(f"{'='*50}")
        print(f"Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        if self.failed_tests:
            print(f"\n❌ FAILED TESTS:")
            for i, test in enumerate(self.failed_tests, 1):
                print(f"{i}. {test['test']}")
                if 'error' in test:
                    print(f"   Error: {test['error']}")
                else:
                    print(f"   Expected: {test['expected']}, Got: {test['actual']}")
        
        return self.tests_passed == self.tests_run

def main():
    print("🚀 Starting Campus Lost & Found API Tests")
    print("=" * 50)
    
    tester = CampusLostFoundTester()
    
    # Run all tests
    tester.test_health_check()
    tester.test_public_endpoints()
    
    # Login as admin first
    if tester.test_admin_login():
        tester.test_admin_endpoints()
        tester.test_super_admin_endpoints()
        tester.test_student_excel_upload()
    
    tester.test_authentication_flow()
    
    # Print final summary
    success = tester.print_summary()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
import requests
import sys
import json
import io
import pandas as pd
from datetime import datetime

class LostFoundAPITester:
    def __init__(self, base_url="https://lostfound-fix.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.admin_token = None
        self.student_token = None
        self.tests_run = 0
        self.tests_passed = 0

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if headers:
            test_headers.update(headers)
        
        if self.admin_token and not headers:
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
                    if 'Content-Type' in test_headers:
                        del test_headers['Content-Type']
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
                    return success, response.json()
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test API health"""
        return self.run_test("Health Check", "GET", "", 200)

    def test_admin_login(self):
        """Test admin login"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/admin/login",
            200,
            data={"username": "superadmin", "password": "SuperAdmin@123"},
            headers={'Content-Type': 'application/json'}
        )
        if success and 'token' in response:
            self.admin_token = response['token']
            print(f"   Admin token obtained: {self.admin_token[:20]}...")
            return True
        return False

    def test_student_login(self):
        """Test student login"""
        success, response = self.run_test(
            "Student Login",
            "POST",
            "auth/student/login",
            200,
            data={"roll_number": "CS002", "dob": "2002-08-20"},
            headers={'Content-Type': 'application/json'}
        )
        if success and 'token' in response:
            self.student_token = response['token']
            print(f"   Student token obtained: {self.student_token[:20]}...")
            return True
        return False

    def test_get_students(self):
        """Test getting students list"""
        success, response = self.run_test(
            "Get Students List",
            "GET",
            "students",
            200
        )
        if success:
            print(f"   Found {len(response)} students")
            for student in response[:3]:  # Show first 3
                print(f"   - {student.get('roll_number')}: {student.get('full_name')}")
        return success, response

    def test_excel_upload(self):
        """Test Excel upload functionality"""
        # Create test Excel file
        test_data = {
            'Roll Number': ['CS002', 'CS006', 'CS007'],  # CS002 is duplicate
            'Full Name': ['Jane Smith', 'New Student 1', 'New Student 2'],
            'Department': ['Computer Science', 'Computer Science', 'Electronics'],
            'Year': ['2', '1', '3'],
            'DOB': ['2002-08-20', '2003-05-15', '2001-12-10'],
            'Email': ['jane@example.com', 'new1@example.com', 'new2@example.com'],
            'Phone Number': ['9876543210', '9876543211', '9876543212']
        }
        
        df = pd.DataFrame(test_data)
        excel_buffer = io.BytesIO()
        df.to_excel(excel_buffer, index=False)
        excel_buffer.seek(0)
        
        files = {'file': ('test_students.xlsx', excel_buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
        
        success, response = self.run_test(
            "Excel Upload",
            "POST",
            "students/upload-excel",
            200,
            files=files
        )
        
        if success:
            print(f"   Added: {response.get('added', 0)}")
            print(f"   Skipped: {response.get('skipped', 0)}")
            print(f"   Message: {response.get('message', '')}")
        
        return success, response

    def test_delete_student(self):
        """Test deleting a student"""
        # First get students to find CS006 or CS007
        success, students = self.test_get_students()
        if not success:
            return False
        
        target_student = None
        for student in students:
            if student.get('roll_number') in ['CS006', 'CS007']:
                target_student = student
                break
        
        if not target_student:
            print("   No test student (CS006/CS007) found to delete")
            return False
        
        student_id = target_student['id']
        roll_number = target_student['roll_number']
        
        success, response = self.run_test(
            f"Delete Student {roll_number}",
            "DELETE",
            f"students/{student_id}",
            200
        )
        
        if success:
            print(f"   Successfully deleted student {roll_number}")
        
        return success

    def test_dashboard_stats(self):
        """Test dashboard statistics"""
        return self.run_test("Dashboard Stats", "GET", "stats", 200)

    def test_get_items(self):
        """Test getting items"""
        return self.run_test("Get Items", "GET", "items", 200)

def main():
    print("🚀 Starting Lost & Found API Tests")
    print("=" * 50)
    
    tester = LostFoundAPITester()
    
    # Test sequence
    tests = [
        ("Health Check", tester.test_health_check),
        ("Admin Login", tester.test_admin_login),
        ("Get Students", tester.test_get_students),
        ("Excel Upload", tester.test_excel_upload),
        ("Delete Student", tester.test_delete_student),
        ("Dashboard Stats", tester.test_dashboard_stats),
        ("Get Items", tester.test_get_items),
        ("Student Login", tester.test_student_login),
    ]
    
    for test_name, test_func in tests:
        try:
            result = test_func()
            if isinstance(result, tuple):
                success = result[0]
            else:
                success = result
                
            if not success and test_name == "Admin Login":
                print("❌ Admin login failed - stopping critical tests")
                break
                
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {str(e)}")
    
    # Print final results
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print("⚠️  Some tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())
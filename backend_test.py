import requests
import sys
import json
import pandas as pd
from datetime import datetime
from io import BytesIO

class StudentDatabaseTester:
    def __init__(self, base_url="https://repo-inspector-75.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.admin_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def log_result(self, test_name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {test_name} - PASSED")
        else:
            self.failed_tests.append(f"{test_name}: {details}")
            print(f"❌ {test_name} - FAILED: {details}")
        if details:
            print(f"   Details: {details}")

    def make_request(self, method, endpoint, data=None, files=None, headers=None):
        """Make HTTP request with error handling"""
        url = f"{self.base_url}/{endpoint}"
        default_headers = {'Content-Type': 'application/json'}
        
        if self.admin_token:
            default_headers['Authorization'] = f'Bearer {self.admin_token}'
        
        if headers:
            default_headers.update(headers)
        
        # Remove Content-Type for file uploads
        if files:
            default_headers.pop('Content-Type', None)
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=default_headers)
            elif method == 'POST':
                if files:
                    response = requests.post(url, files=files, headers=default_headers)
                else:
                    response = requests.post(url, json=data, headers=default_headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=default_headers)
            
            return response
        except Exception as e:
            print(f"Request error: {str(e)}")
            return None

    def test_admin_login(self):
        """Test admin login to get authentication token"""
        print("\n🔐 Testing Admin Login...")
        
        response = self.make_request('POST', 'auth/admin/login', {
            "username": "superadmin",
            "password": "SuperAdmin@123"
        })
        
        if response and response.status_code == 200:
            data = response.json()
            self.admin_token = data.get('token')
            self.log_result("Admin Login", True, f"Token obtained, Role: {data.get('role')}")
            return True
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'No response'
            self.log_result("Admin Login", False, f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
            return False

    def test_student_login_valid_format(self):
        """Test 1.1: Valid login with DD-MM-YYYY format"""
        print("\n👨‍🎓 Testing Student Login - Valid DD-MM-YYYY Format...")
        
        response = self.make_request('POST', 'auth/student/login', {
            "roll_number": "112723205028",
            "dob": "17-04-2006"
        })
        
        if response and response.status_code == 200:
            data = response.json()
            has_token = 'token' in data
            has_user = 'user' in data
            correct_role = data.get('role') == 'student'
            self.log_result("Student Login (Valid DD-MM-YYYY)", 
                          has_token and has_user and correct_role,
                          f"Token: {has_token}, User: {has_user}, Role: {data.get('role')}")
            return True
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'No response'
            self.log_result("Student Login (Valid DD-MM-YYYY)", False, 
                          f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
            return False

    def test_student_login_wrong_format(self):
        """Test 1.2: Login with wrong DOB format (YYYY-MM-DD)"""
        print("\n❌ Testing Student Login - Wrong Format (YYYY-MM-DD)...")
        
        response = self.make_request('POST', 'auth/student/login', {
            "roll_number": "112723205028",
            "dob": "2006-04-17"  # Wrong format
        })
        
        expected_error = response and response.status_code == 401
        error_msg = response.json().get('detail', '') if response else ''
        is_invalid_creds = 'Invalid credentials' in error_msg
        
        self.log_result("Student Login (Wrong Format Rejection)", 
                      expected_error and is_invalid_creds,
                      f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")

    def test_student_login_deleted_user(self):
        """Test 1.3: Login with deleted student"""
        print("\n🚫 Testing Student Login - Deleted Student...")
        
        response = self.make_request('POST', 'auth/student/login', {
            "roll_number": "112723205013",
            "dob": "20-04-2006"
        })
        
        expected_error = response and response.status_code == 401
        error_msg = response.json().get('detail', '') if response else ''
        is_invalid_creds = 'Invalid credentials' in error_msg
        
        self.log_result("Student Login (Deleted User Rejection)", 
                      expected_error and is_invalid_creds,
                      f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")

    def test_student_login_wrong_dob(self):
        """Test 1.4: Login with wrong DOB"""
        print("\n🔒 Testing Student Login - Wrong DOB...")
        
        response = self.make_request('POST', 'auth/student/login', {
            "roll_number": "112723205028",
            "dob": "18-04-2006"  # Wrong date
        })
        
        expected_error = response and response.status_code == 401
        error_msg = response.json().get('detail', '') if response else ''
        is_invalid_creds = 'Invalid credentials' in error_msg
        
        self.log_result("Student Login (Wrong DOB Rejection)", 
                      expected_error and is_invalid_creds,
                      f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")

    def create_test_excel(self, filename, data):
        """Create test Excel file"""
        df = pd.DataFrame(data)
        buffer = BytesIO()
        df.to_excel(buffer, index=False)
        buffer.seek(0)
        return buffer

    def test_excel_upload_valid(self):
        """Test 2.1: Upload valid Excel file"""
        print("\n📊 Testing Excel Upload - Valid File...")
        
        test_data = [
            {
                "Roll Number": "112723205030",
                "Full Name": "TestUser1",
                "Department": "CS",
                "Year": "2",
                "DOB": "10-01-2005",
                "Email": "test1@spcet.ac.in",
                "Phone Number": "9999999991"
            },
            {
                "Roll Number": "112723205031",
                "Full Name": "TestUser2",
                "Department": "ECE",
                "Year": "1",
                "DOB": "11-02-2006",
                "Email": "test2@spcet.ac.in",
                "Phone Number": "9999999992"
            }
        ]
        
        excel_buffer = self.create_test_excel("test_students.xlsx", test_data)
        
        response = self.make_request('POST', 'students/upload-excel', 
                                   files={'file': ('test_students.xlsx', excel_buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')})
        
        if response and response.status_code == 200:
            data = response.json()
            added = data.get('added', 0)
            skipped = data.get('skipped', 0)
            success = added >= 1  # At least one should be added
            self.log_result("Excel Upload (Valid File)", success,
                          f"Added: {added}, Skipped: {skipped}, Message: {data.get('message', '')}")
            return True
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'No response'
            self.log_result("Excel Upload (Valid File)", False,
                          f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
            return False

    def test_excel_upload_duplicates(self):
        """Test 2.2: Upload with duplicates"""
        print("\n🔄 Testing Excel Upload - Duplicates...")
        
        # Try to upload existing student
        test_data = [
            {
                "Roll Number": "112723205028",  # Existing student
                "Full Name": "Sam",
                "Department": "CS",
                "Year": "2",
                "DOB": "17-04-2006",
                "Email": "sam@spcet.ac.in",
                "Phone Number": "9999999999"
            }
        ]
        
        excel_buffer = self.create_test_excel("duplicate_test.xlsx", test_data)
        
        response = self.make_request('POST', 'students/upload-excel',
                                   files={'file': ('duplicate_test.xlsx', excel_buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')})
        
        if response and response.status_code == 200:
            data = response.json()
            added = data.get('added', 0)
            skipped = data.get('skipped', 0)
            success = skipped >= 1 and added == 0  # Should skip existing
            self.log_result("Excel Upload (Duplicate Handling)", success,
                          f"Added: {added}, Skipped: {skipped}, Message: {data.get('message', '')}")
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'No response'
            self.log_result("Excel Upload (Duplicate Handling)", False,
                          f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")

    def test_excel_upload_missing_columns(self):
        """Test 2.3: Upload with missing required columns"""
        print("\n⚠️ Testing Excel Upload - Missing Columns...")
        
        # Missing Email column
        test_data = [
            {
                "Roll Number": "112723205032",
                "Full Name": "TestUser3",
                "Department": "CS",
                "Year": "2",
                "DOB": "10-01-2005",
                "Phone Number": "9999999993"
                # Missing Email column
            }
        ]
        
        excel_buffer = self.create_test_excel("missing_columns.xlsx", test_data)
        
        response = self.make_request('POST', 'students/upload-excel',
                                   files={'file': ('missing_columns.xlsx', excel_buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')})
        
        expected_error = response and response.status_code == 400
        error_msg = response.json().get('detail', '') if response else ''
        has_missing_columns = 'Missing required columns' in error_msg
        
        self.log_result("Excel Upload (Missing Columns Error)", 
                      expected_error and has_missing_columns,
                      f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")

    def test_get_all_students(self):
        """Test 3.1: Get all active students"""
        print("\n📋 Testing Get All Students (Active Only)...")
        
        response = self.make_request('GET', 'students')
        
        if response and response.status_code == 200:
            students = response.json()
            has_students = len(students) > 0
            
            # Check if deleted student (Majja) is NOT in the list
            deleted_student_present = any(s.get('roll_number') == '112723205013' for s in students)
            
            # Check for upload_date and upload_time fields
            has_upload_fields = all('upload_date' in s and 'upload_time' in s for s in students[:3])  # Check first 3
            
            success = has_students and not deleted_student_present and has_upload_fields
            self.log_result("Get All Students (Active)", success,
                          f"Count: {len(students)}, Deleted student excluded: {not deleted_student_present}, Has upload fields: {has_upload_fields}")
            
            # Check DOB format
            if students:
                sample_dob = students[0].get('dob', '')
                correct_format = len(sample_dob) == 10 and sample_dob[2] == '-' and sample_dob[5] == '-'
                self.log_result("DOB Format Verification", correct_format,
                              f"Sample DOB: {sample_dob}, Format DD-MM-YYYY: {correct_format}")
            
            return students
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'No response'
            self.log_result("Get All Students (Active)", False,
                          f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
            return []

    def test_get_students_including_deleted(self):
        """Test 3.2: Get all students including deleted"""
        print("\n🗑️ Testing Get Students Including Deleted...")
        
        response = self.make_request('GET', 'students?include_deleted=true')
        
        if response and response.status_code == 200:
            students = response.json()
            
            # Check if deleted student (Majja) IS in the list
            deleted_student = next((s for s in students if s.get('roll_number') == '112723205013'), None)
            deleted_student_present = deleted_student is not None
            is_marked_deleted = deleted_student.get('is_deleted', False) if deleted_student else False
            
            success = deleted_student_present and is_marked_deleted
            self.log_result("Get Students Including Deleted", success,
                          f"Total: {len(students)}, Deleted student found: {deleted_student_present}, Marked as deleted: {is_marked_deleted}")
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'No response'
            self.log_result("Get Students Including Deleted", False,
                          f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")

    def test_soft_delete_student(self):
        """Test 4.1: Delete a student (soft delete)"""
        print("\n🗑️ Testing Soft Delete Student...")
        
        # First, get a student to delete (try to find one of our test students)
        students_response = self.make_request('GET', 'students')
        if not students_response or students_response.status_code != 200:
            self.log_result("Soft Delete Student", False, "Could not get students list")
            return None
        
        students = students_response.json()
        test_student = next((s for s in students if s.get('roll_number') in ['112723205030', '112723205031']), None)
        
        if not test_student:
            self.log_result("Soft Delete Student", False, "No test student found to delete")
            return None
        
        student_id = test_student['id']
        response = self.make_request('DELETE', f'students/{student_id}')
        
        if response and response.status_code == 200:
            data = response.json()
            success = 'deleted successfully' in data.get('message', '')
            self.log_result("Soft Delete Student", success,
                          f"Student {test_student['roll_number']} deleted: {data.get('message', '')}")
            return test_student
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'No response'
            self.log_result("Soft Delete Student", False,
                          f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
            return None

    def test_deleted_student_cannot_login(self, deleted_student):
        """Test 4.2: Verify deleted student cannot login"""
        if not deleted_student:
            self.log_result("Deleted Student Login Test", False, "No deleted student to test")
            return
        
        print("\n🚫 Testing Deleted Student Cannot Login...")
        
        response = self.make_request('POST', 'auth/student/login', {
            "roll_number": deleted_student['roll_number'],
            "dob": deleted_student['dob']
        })
        
        expected_error = response and response.status_code == 401
        error_msg = response.json().get('detail', '') if response else ''
        is_invalid_creds = 'Invalid credentials' in error_msg
        
        self.log_result("Deleted Student Cannot Login", 
                      expected_error and is_invalid_creds,
                      f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")

    def test_deleted_student_not_in_default_list(self, deleted_student):
        """Test 4.3: Verify deleted student not in default list"""
        if not deleted_student:
            self.log_result("Deleted Student Not In List", False, "No deleted student to test")
            return
        
        print("\n📋 Testing Deleted Student Not In Default List...")
        
        response = self.make_request('GET', 'students')
        
        if response and response.status_code == 200:
            students = response.json()
            deleted_in_list = any(s.get('id') == deleted_student['id'] for s in students)
            
            self.log_result("Deleted Student Not In Default List", 
                          not deleted_in_list,
                          f"Deleted student in default list: {deleted_in_list}")
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'No response'
            self.log_result("Deleted Student Not In Default List", False,
                          f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")

    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting Student Database Backend Tests...")
        print(f"🌐 Testing against: {self.base_url}")
        
        # Authentication
        if not self.test_admin_login():
            print("❌ Cannot proceed without admin authentication")
            return False
        
        # Student Login Tests
        self.test_student_login_valid_format()
        self.test_student_login_wrong_format()
        self.test_student_login_deleted_user()
        self.test_student_login_wrong_dob()
        
        # Excel Upload Tests
        self.test_excel_upload_valid()
        self.test_excel_upload_duplicates()
        self.test_excel_upload_missing_columns()
        
        # Student Database Tests
        students = self.test_get_all_students()
        self.test_get_students_including_deleted()
        
        # Soft Delete Tests
        deleted_student = self.test_soft_delete_student()
        self.test_deleted_student_cannot_login(deleted_student)
        self.test_deleted_student_not_in_default_list(deleted_student)
        
        # Print Summary
        print(f"\n📊 TEST SUMMARY")
        print(f"Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        if self.failed_tests:
            print(f"\n❌ FAILED TESTS:")
            for failure in self.failed_tests:
                print(f"  - {failure}")
        
        return self.tests_passed == self.tests_run

def main():
    tester = StudentDatabaseTester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
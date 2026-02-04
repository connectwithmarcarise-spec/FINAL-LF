import requests
import sys
import json
import pandas as pd
from datetime import datetime
from io import BytesIO

class CampusLostFoundTester:
    def __init__(self, base_url="https://codecheck-24.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.admin_token = None
        self.student_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.test_item_lost_id = None
        self.test_item_found_id = None
        self.test_claim_id = None

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

    def make_request(self, method, endpoint, data=None, files=None, headers=None, use_student_token=False):
        """Make HTTP request with error handling"""
        url = f"{self.base_url}/{endpoint}"
        default_headers = {'Content-Type': 'application/json'}
        
        # Choose token based on parameter
        token = self.student_token if use_student_token else self.admin_token
        if token:
            default_headers['Authorization'] = f'Bearer {token}'
        
        if headers:
            default_headers.update(headers)
        
        # Remove Content-Type for file uploads
        if files:
            default_headers.pop('Content-Type', None)
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=default_headers, timeout=30)
            elif method == 'POST':
                if files:
                    response = requests.post(url, files=files, headers=default_headers, timeout=30)
                else:
                    response = requests.post(url, json=data, headers=default_headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=default_headers, timeout=30)
            
            return response
        except requests.exceptions.Timeout:
            print(f"Request timeout for {method} {endpoint}")
            return None
        except requests.exceptions.ConnectionError:
            print(f"Connection error for {method} {endpoint}")
            return None
        except Exception as e:
            print(f"Request error for {method} {endpoint}: {str(e)}")
            return None

    # ===================== REDESIGNED SYSTEM TESTS =====================
    
    def test_health_check_no_auth(self):
        """Test 1: Health check endpoint should work without authentication"""
        print("\n🏥 Testing Health Check (No Auth Required)...")
        
        # Make request without any token
        original_token = self.admin_token
        self.admin_token = None
        
        response = self.make_request('GET', 'health')
        
        # Restore token
        self.admin_token = original_token
        
        if response and response.status_code == 200:
            data = response.json()
            has_status = 'status' in data
            is_healthy = data.get('status') == 'healthy'
            has_timestamp = 'timestamp' in data
            
            success = has_status and is_healthy and has_timestamp
            self.log_result("Health Check (No Auth)", success,
                          f"Status: {data.get('status')}, Has timestamp: {has_timestamp}")
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'No response'
            self.log_result("Health Check (No Auth)", False,
                          f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")

    def test_lobby_requires_auth(self):
        """Test 2: Lobby endpoints should require authentication"""
        print("\n🔒 Testing Lobby Requires Authentication...")
        
        # Test without token
        original_token = self.admin_token
        self.admin_token = None
        
        response = self.make_request('GET', 'lobby/items')
        
        # Restore token
        self.admin_token = original_token
        
        # Backend returns 403 Forbidden when no auth header is provided
        expected_error = response and response.status_code in [401, 403]
        error_msg = response.json().get('detail', '') if response else ''
        is_auth_error = any(keyword in error_msg.lower() for keyword in ['not authenticated', 'authorization', 'forbidden', 'access'])
        
        self.log_result("Lobby Requires Auth (No Token)", 
                      expected_error,
                      f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")

    def test_lobby_with_auth(self):
        """Test 3: Lobby should work with authentication"""
        print("\n✅ Testing Lobby With Authentication...")
        
        response = self.make_request('GET', 'lobby/items')
        
        if response and response.status_code == 200:
            items = response.json()
            is_list = isinstance(items, list)
            
            # Check item structure
            has_proper_structure = True
            if items:
                sample_item = items[0]
                required_fields = ['id', 'item_type', 'description', 'location', 'available_action']
                has_proper_structure = all(field in sample_item for field in required_fields)
            
            success = is_list and has_proper_structure
            self.log_result("Lobby With Auth", success,
                          f"Items count: {len(items)}, Proper structure: {has_proper_structure}")
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'No response'
            self.log_result("Lobby With Auth", False,
                          f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")

    def test_student_login(self):
        """Test student login to get token for item operations"""
        print("\n👨‍🎓 Testing Student Login for Item Operations...")
        
        response = self.make_request('POST', 'auth/student/login', {
            "roll_number": "112723205028",
            "dob": "17-04-2006"
        })
        
        if response and response.status_code == 200:
            data = response.json()
            self.student_token = data.get('token')
            has_token = 'token' in data
            correct_role = data.get('role') == 'student'
            
            self.log_result("Student Login for Testing", 
                          has_token and correct_role,
                          f"Token obtained: {has_token}, Role: {data.get('role')}")
            return True
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'No response'
            self.log_result("Student Login for Testing", False,
                          f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
            return False

    def test_create_lost_item(self):
        """Test creating a LOST item for testing found-response"""
        print("\n📱 Creating Test LOST Item...")
        
        # Use requests.post with data parameter for form data
        url = f"{self.base_url}/items"
        headers = {'Authorization': f'Bearer {self.student_token}'}
        
        form_data = {
            'item_type': 'lost',
            'item_keyword': 'Smartphone',
            'description': 'Black iPhone 14 Pro with cracked screen on the back. Has a blue case with university sticker.',
            'location': 'Library 2nd Floor',
            'approximate_time': 'Afternoon',
            'secret_message': 'The phone has a small scratch near the camera and my name "Alex" is engraved on the back case'
        }
        
        try:
            response = requests.post(url, data=form_data, headers=headers)
        except Exception as e:
            self.log_result("Create LOST Item", False, f"Request error: {str(e)}")
            return False
        
        if response and response.status_code == 200:
            data = response.json()
            self.test_item_lost_id = data.get('item_id')
            success = 'successfully' in data.get('message', '')
            
            self.log_result("Create LOST Item", success,
                          f"Item ID: {self.test_item_lost_id}, Message: {data.get('message')}")
            return True
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'No response'
            self.log_result("Create LOST Item", False,
                          f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
            return False

    def test_create_found_item(self):
        """Test creating a FOUND item for testing claims"""
        print("\n💼 Creating Test FOUND Item...")
        
        # Use requests.post with data parameter for form data
        url = f"{self.base_url}/items"
        headers = {'Authorization': f'Bearer {self.student_token}'}
        
        form_data = {
            'item_type': 'found',
            'item_keyword': 'Wallet',
            'description': 'Brown leather wallet found in cafeteria. Contains some cards and cash.',
            'location': 'Main Cafeteria',
            'approximate_time': 'Morning',
            'secret_message': 'The wallet has a student ID card with photo and some credit cards inside'
        }
        
        try:
            response = requests.post(url, data=form_data, headers=headers)
        except Exception as e:
            self.log_result("Create FOUND Item", False, f"Request error: {str(e)}")
            return False
        
        if response and response.status_code == 200:
            data = response.json()
            self.test_item_found_id = data.get('item_id')
            success = 'successfully' in data.get('message', '')
            
            self.log_result("Create FOUND Item", success,
                          f"Item ID: {self.test_item_found_id}, Message: {data.get('message')}")
            return True
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'No response'
            self.log_result("Create FOUND Item", False,
                          f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
            return False

    def test_claim_lost_item_should_fail(self):
        """Test 4: Claims should REJECT if item is LOST (semantic fix)"""
        print("\n❌ Testing Claim LOST Item (Should Fail)...")
        
        if not self.test_item_lost_id:
            self.log_result("Claim LOST Item (Should Fail)", False, "No LOST item ID available")
            return
        
        response = self.make_request('POST', 'claims', {
            "item_id": self.test_item_lost_id,
            "message": "This is my lost phone"
        }, use_student_token=True)
        
        expected_error = response and response.status_code == 400
        error_msg = response.json().get('detail', '') if response else ''
        correct_semantic_error = 'Claims are only for FOUND items' in error_msg or 'Use \'I Found This\' button' in error_msg
        
        self.log_result("Claim LOST Item (Should Fail)", 
                      expected_error and correct_semantic_error,
                      f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")

    def test_found_response_for_lost_item(self):
        """Test 5: Found response should work for LOST items"""
        print("\n✅ Testing Found Response for LOST Item...")
        
        if not self.test_item_lost_id:
            self.log_result("Found Response for LOST Item", False, "No LOST item ID available")
            return
        
        response = self.make_request('POST', f'items/{self.test_item_lost_id}/found-response', {
            "item_id": self.test_item_lost_id,
            "message": "I found your phone in the library. It matches your description.",
            "found_location": "Library 3rd Floor Study Area",
            "found_time": "Evening"
        }, use_student_token=True)
        
        if response and response.status_code == 200:
            data = response.json()
            success = 'submitted' in data.get('message', '')
            has_response_id = 'response_id' in data
            
            self.log_result("Found Response for LOST Item", success and has_response_id,
                          f"Message: {data.get('message')}, Response ID: {data.get('response_id')}")
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'No response'
            self.log_result("Found Response for LOST Item", False,
                          f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")

    def test_found_response_for_found_item_should_fail(self):
        """Test: Found response should NOT work for FOUND items"""
        print("\n❌ Testing Found Response for FOUND Item (Should Fail)...")
        
        if not self.test_item_found_id:
            self.log_result("Found Response for FOUND Item (Should Fail)", False, "No FOUND item ID available")
            return
        
        response = self.make_request('POST', f'items/{self.test_item_found_id}/found-response', {
            "item_id": self.test_item_found_id,
            "message": "I found this item",
            "found_location": "Somewhere",
            "found_time": "Now"
        }, use_student_token=True)
        
        expected_error = response and response.status_code == 400
        error_msg = response.json().get('detail', '') if response else ''
        correct_semantic_error = 'only for LOST items' in error_msg
        
        self.log_result("Found Response for FOUND Item (Should Fail)", 
                      expected_error and correct_semantic_error,
                      f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")

    def test_claim_found_item(self):
        """Test: Claims should work for FOUND items"""
        print("\n✅ Testing Claim FOUND Item...")
        
        if not self.test_item_found_id:
            self.log_result("Claim FOUND Item", False, "No FOUND item ID available")
            return
        
        response = self.make_request('POST', 'claims', {
            "item_id": self.test_item_found_id,
            "message": "This is my wallet. I lost it yesterday in the cafeteria."
        }, use_student_token=True)
        
        if response and response.status_code == 200:
            data = response.json()
            self.test_claim_id = data.get('claim_id')
            success = 'submitted' in data.get('message', '')
            
            self.log_result("Claim FOUND Item", success,
                          f"Claim ID: {self.test_claim_id}, Message: {data.get('message')}")
            return True
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'No response'
            self.log_result("Claim FOUND Item", False,
                          f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
            return False

    def test_claim_decision_no_reason(self):
        """Test 6: Claim decision should require reason field"""
        print("\n❌ Testing Claim Decision Without Reason (Should Fail)...")
        
        if not self.test_claim_id:
            self.log_result("Claim Decision No Reason", False, "No claim ID available")
            return
        
        response = self.make_request('POST', f'claims/{self.test_claim_id}/decision', {
            "status": "approved"
            # Missing reason field
        })
        
        expected_error = response and response.status_code == 400
        error_msg = response.json().get('detail', '') if response else ''
        reason_required = 'reason' in error_msg.lower() and 'mandatory' in error_msg.lower()
        
        self.log_result("Claim Decision No Reason", 
                      expected_error and reason_required,
                      f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")

    def test_claim_decision_short_reason(self):
        """Test 7: Claim decision should require minimum 10 chars reason"""
        print("\n❌ Testing Claim Decision Short Reason (Should Fail)...")
        
        if not self.test_claim_id:
            self.log_result("Claim Decision Short Reason", False, "No claim ID available")
            return
        
        response = self.make_request('POST', f'claims/{self.test_claim_id}/decision', {
            "status": "approved",
            "reason": "OK"  # Too short (less than 10 chars)
        })
        
        expected_error = response and response.status_code == 400
        error_msg = response.json().get('detail', '') if response else ''
        min_chars_error = '10 characters' in error_msg or 'minimum' in error_msg.lower()
        
        self.log_result("Claim Decision Short Reason", 
                      expected_error and min_chars_error,
                      f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")

    def test_claim_decision_proper_reason(self):
        """Test 8: Claim decision should work with proper reason (>=10 chars)"""
        print("\n✅ Testing Claim Decision With Proper Reason...")
        
        if not self.test_claim_id:
            self.log_result("Claim Decision Proper Reason", False, "No claim ID available")
            return
        
        response = self.make_request('POST', f'claims/{self.test_claim_id}/decision', {
            "status": "approved",
            "reason": "Student provided valid identification and description matches the found wallet perfectly."
        })
        
        if response and response.status_code == 200:
            data = response.json()
            success = 'approved' in data.get('message', '')
            
            self.log_result("Claim Decision Proper Reason", success,
                          f"Message: {data.get('message')}")
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'No response'
            self.log_result("Claim Decision Proper Reason", False,
                          f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")

    def test_students_by_context(self):
        """Test: Students by context endpoint"""
        print("\n📚 Testing Students By Context...")
        
        response = self.make_request('GET', 'students/by-context?department=CS&year=2')
        
        if response and response.status_code == 200:
            data = response.json()
            has_department = data.get('department') == 'CS'
            has_year = data.get('year') == '2'
            has_students = 'students' in data
            has_count = 'total_count' in data
            
            success = has_department and has_year and has_students and has_count
            self.log_result("Students By Context", success,
                          f"Dept: {data.get('department')}, Year: {data.get('year')}, Count: {data.get('total_count')}")
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'No response'
            self.log_result("Students By Context", False,
                          f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")

    def test_student_contexts(self):
        """Test: Get available student contexts"""
        print("\n🏫 Testing Student Contexts...")
        
        response = self.make_request('GET', 'students/contexts')
        
        if response and response.status_code == 200:
            contexts = response.json()
            is_dict = isinstance(contexts, dict)
            has_departments = len(contexts) > 0 if is_dict else False
            
            # Check structure
            proper_structure = True
            if is_dict and contexts:
                sample_dept = list(contexts.values())[0]
                proper_structure = 'years' in sample_dept and 'total' in sample_dept
            
            success = is_dict and has_departments and proper_structure
            self.log_result("Student Contexts", success,
                          f"Departments: {len(contexts) if is_dict else 0}, Proper structure: {proper_structure}")
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'No response'
            self.log_result("Student Contexts", False,
                          f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")

    # ===================== LEGACY TESTS (Keep for compatibility) =====================
    
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
        """Run all backend tests for redesigned Campus Lost & Found system"""
        print("🚀 Starting Campus Lost & Found Backend Tests...")
        print(f"🌐 Testing against: {self.base_url}")
        
        # Authentication
        if not self.test_admin_login():
            print("❌ Cannot proceed without admin authentication")
            return False
        
        # ===================== REDESIGNED SYSTEM TESTS =====================
        print("\n" + "="*60)
        print("🔄 TESTING REDESIGNED CAMPUS LOST & FOUND SYSTEM")
        print("="*60)
        
        # Core System Tests
        self.test_health_check_no_auth()
        self.test_lobby_requires_auth()
        self.test_lobby_with_auth()
        
        # Student Authentication for Item Operations
        if not self.test_student_login():
            print("❌ Cannot proceed with item tests without student authentication")
        else:
            # Create test items
            self.test_create_lost_item()
            self.test_create_found_item()
            
            # Semantic Tests - Claims vs Found Responses
            self.test_claim_lost_item_should_fail()
            self.test_found_response_for_lost_item()
            self.test_found_response_for_found_item_should_fail()
            
            # Claims for FOUND items
            if self.test_claim_found_item():
                # Admin accountability tests
                self.test_claim_decision_no_reason()
                self.test_claim_decision_short_reason()
                self.test_claim_decision_proper_reason()
        
        # Context-based student management
        self.test_students_by_context()
        self.test_student_contexts()
        
        # ===================== LEGACY TESTS =====================
        print("\n" + "="*60)
        print("📚 RUNNING LEGACY COMPATIBILITY TESTS")
        print("="*60)
        
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
        else:
            print(f"\n🎉 ALL TESTS PASSED!")
        
        return self.tests_passed == self.tests_run

def main():
    tester = CampusLostFoundTester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
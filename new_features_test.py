import requests
import sys
import json
from datetime import datetime

class NewFeaturesTester:
    def __init__(self, base_url="https://git-inspector-12.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.admin_token = None
        self.sam_token = None
        self.raju_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.test_post_id = None
        self.test_comment_id = None
        self.test_item_id = None

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

    def make_request(self, method, endpoint, data=None, files=None, headers=None, token=None):
        """Make HTTP request with error handling"""
        url = f"{self.base_url}/{endpoint}"
        default_headers = {'Content-Type': 'application/json'}
        
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

    def login_admin(self):
        """Login as admin"""
        print("\n🔐 Logging in as Admin...")
        
        response = self.make_request('POST', 'auth/admin/login', {
            "username": "superadmin",
            "password": "SuperAdmin@123"
        })
        
        if response and response.status_code == 200:
            data = response.json()
            self.admin_token = data.get('token')
            self.log_result("Admin Login", True, f"Role: {data.get('role')}")
            return True
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'No response'
            self.log_result("Admin Login", False, f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
            return False

    def login_sam_student(self):
        """Login as Sam student"""
        print("\n👨‍🎓 Logging in as Sam (Student 1)...")
        
        response = self.make_request('POST', 'auth/student/login', {
            "roll_number": "112723205028",
            "dob": "17-04-2006"
        })
        
        if response and response.status_code == 200:
            data = response.json()
            self.sam_token = data.get('token')
            self.log_result("Sam Student Login", True, f"Logged in as Sam")
            return True
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'No response'
            self.log_result("Sam Student Login", False, f"Error: {error_msg}")
            return False

    def login_raju_student(self):
        """Login as RAJU student"""
        print("\n👨‍🎓 Logging in as RAJU (Student 2)...")
        
        response = self.make_request('POST', 'auth/student/login', {
            "roll_number": "112723205047",
            "dob": "23-04-2006"
        })
        
        if response and response.status_code == 200:
            data = response.json()
            self.raju_token = data.get('token')
            self.log_result("RAJU Student Login", True, f"Logged in as RAJU")
            return True
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'No response'
            self.log_result("RAJU Student Login", False, f"Error: {error_msg}")
            return False

    # ===================== CAMPUS FEED API TESTS =====================
    
    def test_create_feed_post_admin(self):
        """Test POST /api/feed/posts - Admin creates a post"""
        print("\n📢 Testing Campus Feed - Admin Create Post...")
        
        # Use form data as specified in the review request
        url = f"{self.base_url}/feed/posts"
        headers = {'Authorization': f'Bearer {self.admin_token}'}
        
        form_data = {
            'title': 'Welcome to New Academic Year',
            'description': 'We are excited to welcome all students to the new academic year. Please check the notice board for important updates.',
            'post_type': 'announcement'
        }
        
        try:
            response = requests.post(url, data=form_data, headers=headers, timeout=30)
        except Exception as e:
            self.log_result("Campus Feed - Admin Create Post", False, f"Request error: {str(e)}")
            return False
        
        if response and response.status_code == 200:
            data = response.json()
            self.test_post_id = data.get('post_id') or data.get('id')
            success = 'successfully' in data.get('message', '').lower() or self.test_post_id is not None
            
            self.log_result("Campus Feed - Admin Create Post", success,
                          f"Post ID: {self.test_post_id}, Message: {data.get('message', '')}")
            return True
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'No response'
            self.log_result("Campus Feed - Admin Create Post", False,
                          f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
            return False

    def test_get_feed_posts(self):
        """Test GET /api/feed/posts - Get all feed posts"""
        print("\n📋 Testing Campus Feed - Get All Posts...")
        
        response = self.make_request('GET', 'feed/posts', token=self.sam_token)
        
        if response and response.status_code == 200:
            posts = response.json()
            is_list = isinstance(posts, list)
            has_posts = len(posts) > 0 if is_list else False
            
            # Check post structure if posts exist
            proper_structure = True
            if has_posts:
                sample_post = posts[0]
                required_fields = ['id', 'title', 'description', 'post_type']
                proper_structure = all(field in sample_post for field in required_fields)
            
            success = is_list and proper_structure
            self.log_result("Campus Feed - Get All Posts", success,
                          f"Posts count: {len(posts) if is_list else 0}, Proper structure: {proper_structure}")
            return True
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'No response'
            self.log_result("Campus Feed - Get All Posts", False,
                          f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
            return False

    def test_like_feed_post(self):
        """Test POST /api/feed/posts/{post_id}/like - Like/unlike a post"""
        print("\n👍 Testing Campus Feed - Like Post...")
        
        if not self.test_post_id:
            self.log_result("Campus Feed - Like Post", False, "No post ID available")
            return False
        
        response = self.make_request('POST', f'feed/posts/{self.test_post_id}/like', 
                                   data={}, token=self.sam_token)
        
        if response and response.status_code == 200:
            data = response.json()
            success = 'like' in data.get('message', '').lower() or 'success' in data.get('message', '').lower()
            
            self.log_result("Campus Feed - Like Post", success,
                          f"Message: {data.get('message', '')}")
            return True
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'No response'
            self.log_result("Campus Feed - Like Post", False,
                          f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
            return False

    def test_add_comment_to_post(self):
        """Test POST /api/feed/posts/{post_id}/comments - Add comment (student only)"""
        print("\n💬 Testing Campus Feed - Add Comment...")
        
        if not self.test_post_id:
            self.log_result("Campus Feed - Add Comment", False, "No post ID available")
            return False
        
        response = self.make_request('POST', f'feed/posts/{self.test_post_id}/comments', 
                                   data={'content': 'Thank you for this important announcement!'}, 
                                   token=self.raju_token)
        
        if response and response.status_code == 200:
            data = response.json()
            self.test_comment_id = data.get('comment_id') or data.get('id')
            success = 'comment' in data.get('message', '').lower() or self.test_comment_id is not None
            
            self.log_result("Campus Feed - Add Comment", success,
                          f"Comment ID: {self.test_comment_id}, Message: {data.get('message', '')}")
            return True
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'No response'
            self.log_result("Campus Feed - Add Comment", False,
                          f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
            return False

    def test_delete_comment(self):
        """Test DELETE /api/feed/posts/{post_id}/comments/{comment_id} - Delete comment"""
        print("\n🗑️ Testing Campus Feed - Delete Comment...")
        
        if not self.test_post_id or not self.test_comment_id:
            self.log_result("Campus Feed - Delete Comment", False, "No post ID or comment ID available")
            return False
        
        # Admin should be able to delete any comment
        response = self.make_request('DELETE', f'feed/posts/{self.test_post_id}/comments/{self.test_comment_id}', 
                                   token=self.admin_token)
        
        if response and response.status_code == 200:
            data = response.json()
            success = 'deleted' in data.get('message', '').lower() or 'success' in data.get('message', '').lower()
            
            self.log_result("Campus Feed - Delete Comment", success,
                          f"Message: {data.get('message', '')}")
            return True
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'No response'
            self.log_result("Campus Feed - Delete Comment", False,
                          f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
            return False

    # ===================== AI MATCHING API FIX TESTS =====================
    
    def create_test_items_for_ai_matching(self):
        """Create test items to verify AI matching works"""
        print("\n📱 Creating Test Items for AI Matching...")
        
        # Create a LOST item as Sam
        url = f"{self.base_url}/items"
        headers = {'Authorization': f'Bearer {self.sam_token}'}
        
        lost_item_data = {
            'item_type': 'lost',
            'item_keyword': 'iPhone',
            'description': 'Black iPhone 14 with cracked screen protector',
            'location': 'Library 2nd Floor',
            'approximate_time': 'Afternoon',
            'secret_message': 'Phone has a red case with university sticker'
        }
        
        try:
            response = requests.post(url, data=lost_item_data, headers=headers)
            if response.status_code == 200:
                lost_item_id = response.json().get('item_id')
                print(f"   Created LOST item: {lost_item_id}")
            else:
                print(f"   Failed to create LOST item: {response.json().get('detail', 'Unknown error')}")
        except Exception as e:
            print(f"   Error creating LOST item: {str(e)}")
        
        # Create a FOUND item as RAJU
        headers = {'Authorization': f'Bearer {self.raju_token}'}
        
        found_item_data = {
            'item_type': 'found',
            'item_keyword': 'iPhone',
            'description': 'Black iPhone with damaged screen found in library',
            'location': 'Library Study Area',
            'approximate_time': 'Evening',
            'secret_message': 'Phone has protective case and some stickers'
        }
        
        try:
            response = requests.post(url, data=found_item_data, headers=headers)
            if response.status_code == 200:
                found_item_id = response.json().get('item_id')
                print(f"   Created FOUND item: {found_item_id}")
                self.test_item_id = found_item_id
            else:
                print(f"   Failed to create FOUND item: {response.json().get('detail', 'Unknown error')}")
        except Exception as e:
            print(f"   Error creating FOUND item: {str(e)}")

    def test_ai_matches_non_zero_percentages(self):
        """Test GET /api/ai/matches - Should show non-zero match percentages"""
        print("\n🤖 Testing AI Matching - Non-Zero Percentages...")
        
        response = self.make_request('GET', 'ai/matches', token=self.sam_token)
        
        if response and response.status_code == 200:
            matches = response.json()
            is_list = isinstance(matches, list)
            has_matches = len(matches) > 0 if is_list else False
            
            # Check for non-zero confidence/percentage
            non_zero_matches = 0
            if has_matches:
                for match in matches:
                    confidence = match.get('confidence', 0)
                    percentage = match.get('percentage', 0)
                    match_score = match.get('match_score', 0)
                    
                    # Check if any confidence metric is non-zero
                    if confidence > 0 or percentage > 0 or match_score > 0:
                        non_zero_matches += 1
            
            success = has_matches and non_zero_matches > 0
            self.log_result("AI Matching - Non-Zero Percentages", success,
                          f"Total matches: {len(matches) if is_list else 0}, Non-zero matches: {non_zero_matches}")
            return True
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'No response'
            self.log_result("AI Matching - Non-Zero Percentages", False,
                          f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
            return False

    def test_ai_matches_fallback_algorithm(self):
        """Test AI matching fallback algorithm when AI unavailable"""
        print("\n🔄 Testing AI Matching - Fallback Algorithm...")
        
        # The fallback should work even when AI is unavailable
        response = self.make_request('GET', 'ai/matches', token=self.raju_token)
        
        if response and response.status_code == 200:
            matches = response.json()
            is_list = isinstance(matches, list)
            
            # Even if AI is unavailable, fallback should return structured data
            success = is_list
            if is_list and len(matches) > 0:
                # Check if matches have required structure
                sample_match = matches[0]
                has_structure = 'item_id' in sample_match and ('confidence' in sample_match or 'match_score' in sample_match)
                success = success and has_structure
            
            self.log_result("AI Matching - Fallback Algorithm", success,
                          f"Matches returned: {len(matches) if is_list else 0}, Has structure: {success}")
            return True
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'No response'
            self.log_result("AI Matching - Fallback Algorithm", False,
                          f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
            return False

    # ===================== ITEMS PUBLIC API - OWNERSHIP FLAG TESTS =====================
    
    def test_items_public_ownership_flag(self):
        """Test GET /api/items/public - Each item should have is_owner boolean flag"""
        print("\n🏷️ Testing Items Public API - Ownership Flag...")
        
        response = self.make_request('GET', 'items/public', token=self.sam_token)
        
        if response and response.status_code == 200:
            items = response.json()
            is_list = isinstance(items, list)
            has_items = len(items) > 0 if is_list else False
            
            # Check ownership flag structure
            ownership_flags_present = True
            owner_items_count = 0
            non_owner_items_count = 0
            
            if has_items:
                for item in items:
                    if 'is_owner' not in item:
                        ownership_flags_present = False
                        break
                    
                    if item.get('is_owner') == True:
                        owner_items_count += 1
                    elif item.get('is_owner') == False:
                        non_owner_items_count += 1
            
            success = is_list and ownership_flags_present
            self.log_result("Items Public API - Ownership Flag", success,
                          f"Items: {len(items) if is_list else 0}, Ownership flags present: {ownership_flags_present}, Owner items: {owner_items_count}, Non-owner items: {non_owner_items_count}")
            return True
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'No response'
            self.log_result("Items Public API - Ownership Flag", False,
                          f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
            return False

    def test_ownership_flag_accuracy(self):
        """Test that is_owner flag is accurate for different users"""
        print("\n🎯 Testing Ownership Flag Accuracy...")
        
        if not self.test_item_id:
            self.log_result("Ownership Flag Accuracy", False, "No test item ID available")
            return False
        
        # Test as RAJU (should be owner of the test item)
        response_raju = self.make_request('GET', 'items/public', token=self.raju_token)
        
        # Test as Sam (should NOT be owner of RAJU's item)
        response_sam = self.make_request('GET', 'items/public', token=self.sam_token)
        
        if response_raju and response_raju.status_code == 200 and response_sam and response_sam.status_code == 200:
            raju_items = response_raju.json()
            sam_items = response_sam.json()
            
            # Find the test item in both responses
            raju_test_item = next((item for item in raju_items if item.get('id') == self.test_item_id), None)
            sam_test_item = next((item for item in sam_items if item.get('id') == self.test_item_id), None)
            
            raju_is_owner = raju_test_item.get('is_owner') if raju_test_item else None
            sam_is_owner = sam_test_item.get('is_owner') if sam_test_item else None
            
            # RAJU should see is_owner=true, Sam should see is_owner=false
            success = raju_is_owner == True and sam_is_owner == False
            
            self.log_result("Ownership Flag Accuracy", success,
                          f"RAJU sees is_owner: {raju_is_owner}, Sam sees is_owner: {sam_is_owner}")
            return True
        else:
            self.log_result("Ownership Flag Accuracy", False, "Failed to get items for both users")
            return False

    def run_new_features_tests(self):
        """Run all new features tests"""
        print("🚀 Starting New Features Tests for Campus Lost & Found...")
        print(f"🌐 Testing against: {self.base_url}")
        
        # Authentication
        if not self.login_admin():
            print("❌ Cannot proceed without admin authentication")
            return False
        
        if not self.login_sam_student():
            print("❌ Cannot proceed without Sam student authentication")
            return False
        
        if not self.login_raju_student():
            print("❌ Cannot proceed without RAJU student authentication")
            return False
        
        # ===================== CAMPUS FEED API TESTS =====================
        print("\n" + "="*60)
        print("📢 TESTING CAMPUS NOTICE & APPRECIATION FEED")
        print("="*60)
        
        self.test_create_feed_post_admin()
        self.test_get_feed_posts()
        self.test_like_feed_post()
        self.test_add_comment_to_post()
        self.test_delete_comment()
        
        # ===================== AI MATCHING API FIX TESTS =====================
        print("\n" + "="*60)
        print("🤖 TESTING AI MATCHING API FIX")
        print("="*60)
        
        self.create_test_items_for_ai_matching()
        self.test_ai_matches_non_zero_percentages()
        self.test_ai_matches_fallback_algorithm()
        
        # ===================== ITEMS PUBLIC API - OWNERSHIP FLAG TESTS =====================
        print("\n" + "="*60)
        print("🏷️ TESTING ITEMS PUBLIC API - OWNERSHIP FLAG")
        print("="*60)
        
        self.test_items_public_ownership_flag()
        self.test_ownership_flag_accuracy()
        
        # Print Summary
        print(f"\n📊 NEW FEATURES TEST SUMMARY")
        print(f"Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        if self.failed_tests:
            print(f"\n❌ FAILED TESTS:")
            for failure in self.failed_tests:
                print(f"  - {failure}")
        else:
            print(f"\n🎉 ALL NEW FEATURES TESTS PASSED!")
        
        return self.tests_passed == self.tests_run

def main():
    tester = NewFeaturesTester()
    success = tester.run_new_features_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
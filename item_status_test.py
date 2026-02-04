#!/usr/bin/env python3
"""
Final AI Verification Test - Item Status Validation
Tests that claimed/archived items cannot be claimed again.
"""

import requests
import sys

def test_item_status_validation():
    """Test that claimed/archived items cannot be claimed again"""
    base_url = "https://codecheck-24.preview.emergentagent.com/api"
    
    print("🚀 Testing Item Status Validation for AI Claims")
    print("="*60)
    
    # Login as admin
    admin_response = requests.post(f"{base_url}/auth/admin/login", json={
        "username": "superadmin",
        "password": "SuperAdmin@123"
    })
    
    if admin_response.status_code != 200:
        print("❌ Admin login failed")
        return False
    
    admin_token = admin_response.json().get('token')
    print("✅ Admin login successful")
    
    # Login as Sam
    sam_response = requests.post(f"{base_url}/auth/student/login", json={
        "roll_number": "112723205028",
        "dob": "17-04-2006"
    })
    
    if sam_response.status_code != 200:
        print("❌ Sam login failed")
        return False
    
    sam_token = sam_response.json().get('token')
    print("✅ Sam login successful")
    
    # Login as RAJU
    raju_response = requests.post(f"{base_url}/auth/student/login", json={
        "roll_number": "112723205047",
        "dob": "23-04-2006"
    })
    
    if raju_response.status_code != 200:
        print("❌ RAJU login failed")
        return False
    
    raju_token = raju_response.json().get('token')
    print("✅ RAJU login successful")
    
    # Create FOUND item as Sam
    print("📱 Creating FOUND item as Sam...")
    item_data = {
        'item_type': 'found',
        'item_keyword': 'Wallet',
        'description': 'Brown leather wallet found in cafeteria with student cards inside',
        'location': 'Main Cafeteria',
        'approximate_time': 'Morning',
        'secret_message': 'Wallet contains student ID card and library card with name visible'
    }
    
    item_response = requests.post(f"{base_url}/items", 
                                 data=item_data, 
                                 headers={'Authorization': f'Bearer {sam_token}'})
    
    if item_response.status_code != 200:
        print(f"❌ Item creation failed: {item_response.status_code}")
        return False
    
    item_id = item_response.json().get('item_id')
    print(f"✅ FOUND item created: {item_id}")
    
    # Create AI claim as RAJU
    print("🤖 Creating AI claim as RAJU...")
    ai_data = {
        'item_id': item_id,
        'product_type': 'Brown Leather Wallet',
        'description': 'Brown leather wallet with student identification cards inside',
        'identification_marks': 'Student ID card and library card visible inside wallet',
        'lost_location': 'Main Cafeteria area',
        'approximate_date': 'This morning around 9 AM'
    }
    
    ai_response = requests.post(f"{base_url}/claims/ai-powered", 
                               data=ai_data, 
                               headers={'Authorization': f'Bearer {raju_token}'})
    
    if ai_response.status_code != 200:
        print(f"❌ AI claim creation failed: {ai_response.status_code}")
        return False
    
    claim_id = ai_response.json().get('claim_id')
    print(f"✅ AI claim created: {claim_id}")
    
    # Approve the claim as admin (this will change item status)
    print("👮 Approving claim as admin...")
    decision_response = requests.post(f"{base_url}/claims/{claim_id}/decision", 
                                     json={
                                         "status": "approved",
                                         "reason": "Student provided valid identification and description matches perfectly."
                                     },
                                     headers={'Authorization': f'Bearer {admin_token}'})
    
    if decision_response.status_code != 200:
        print(f"❌ Claim approval failed: {decision_response.status_code}")
        return False
    
    print("✅ Claim approved successfully")
    
    # Try to create another AI claim on the same item (should fail)
    print("🚫 Attempting second AI claim on same item (should fail)...")
    second_ai_data = {
        'item_id': item_id,
        'product_type': 'Wallet',
        'description': 'My brown wallet that I lost',
        'identification_marks': 'Has my student ID inside',
        'lost_location': 'Cafeteria',
        'approximate_date': 'Today'
    }
    
    second_ai_response = requests.post(f"{base_url}/claims/ai-powered", 
                                      data=second_ai_data, 
                                      headers={'Authorization': f'Bearer {raju_token}'})
    
    # Should fail because item is already claimed
    if second_ai_response.status_code == 400:
        error_msg = second_ai_response.json().get('detail', '')
        if ('already' in error_msg.lower() or 
            'claimed' in error_msg.lower() or 
            'cannot be claimed' in error_msg.lower()):
            print("✅ Second claim correctly rejected - item status validation working")
            return True
        else:
            print(f"❌ Wrong error message: {error_msg}")
            return False
    else:
        print(f"❌ Second claim should have failed with 400, got: {second_ai_response.status_code}")
        return False

if __name__ == "__main__":
    success = test_item_status_validation()
    if success:
        print("\n🎉 ITEM STATUS VALIDATION TEST PASSED!")
        print("✅ Claimed/archived items cannot be claimed again")
    sys.exit(0 if success else 1)
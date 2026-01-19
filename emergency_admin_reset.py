#!/usr/bin/env python3
"""
EMERGENCY ADMIN PASSWORD RESET TOOL
Use this to reset super admin password when login fails
"""

from motor.motor_asyncio import AsyncIOMotorClient
import asyncio
import bcrypt
import uuid
from datetime import datetime, timezone

async def emergency_reset():
    print("="*70)
    print("EMERGENCY SUPER ADMIN PASSWORD RESET")
    print("="*70)
    
    # Get new password from user
    print("\nEnter new password for superadmin:")
    print("(or press Enter to use default: admin123)")
    new_password = input("> ").strip()
    
    if not new_password:
        new_password = "admin123"
    
    print(f"\nUsing password: {new_password}")
    
    # Connect to database
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["lost_found_db"]
    
    # Check if superadmin exists
    existing = await db.admins.find_one({"username": "superadmin"})
    
    if existing:
        print("\n✓ Found existing superadmin")
        print(f"  ID: {existing.get('id')}")
        
        # Hash the new password
        password_hash = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt()).decode()
        
        # Update password
        result = await db.admins.update_one(
            {"username": "superadmin"},
            {"$set": {"password": password_hash}}
        )
        
        print(f"\n✓ Password updated successfully!")
        
    else:
        print("\n⚠ No superadmin found. Creating new one...")
        
        # Hash password
        password_hash = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt()).decode()
        
        # Create new superadmin
        superadmin = {
            "id": str(uuid.uuid4()),
            "username": "superadmin",
            "password": password_hash,
            "full_name": "Super Administrator",
            "role": "super_admin",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.admins.insert_one(superadmin)
        print("✓ New superadmin created!")
    
    # Verify the password works
    print("\n" + "="*70)
    print("VERIFICATION TEST")
    print("="*70)
    
    admin = await db.admins.find_one({"username": "superadmin"})
    
    if bcrypt.checkpw(new_password.encode(), admin["password"].encode()):
        print("✓ Password verification: SUCCESS")
        print("\n" + "="*70)
        print("LOGIN CREDENTIALS")
        print("="*70)
        print(f"Username: superadmin")
        print(f"Password: {new_password}")
        print("="*70)
    else:
        print("✗ Password verification: FAILED")
        print("Something went wrong!")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(emergency_reset())

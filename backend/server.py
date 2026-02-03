from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, date
import jwt
import bcrypt
import shutil
import json
import pandas as pd
from io import BytesIO

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'campus_lost_found_secret_key')
JWT_ALGORITHM = "HS256"

# Create the main app
app = FastAPI(title="Campus Lost & Found API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()

# Upload directories
UPLOAD_DIR = ROOT_DIR / "uploads"
ITEMS_DIR = UPLOAD_DIR / "items"
PROFILES_DIR = UPLOAD_DIR / "profiles"
ITEMS_DIR.mkdir(parents=True, exist_ok=True)
PROFILES_DIR.mkdir(parents=True, exist_ok=True)

# Mount static files
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# ===================== MODELS =====================

class StudentCreate(BaseModel):
    roll_number: str
    full_name: str
    department: str
    year: str
    dob: str  # DD-MM-YYYY format (e.g., 17-04-2006)
    email: str
    phone_number: str

class StudentLogin(BaseModel):
    roll_number: str
    dob: str  # DD-MM-YYYY format (e.g., 17-04-2006)

class AdminLogin(BaseModel):
    username: str
    password: str

class AdminCreate(BaseModel):
    username: str
    password: str
    full_name: str

class AdminPasswordChange(BaseModel):
    old_password: str
    new_password: str

class ItemCreate(BaseModel):
    item_type: str  # "lost" or "found"
    item_keyword: str  # Phone, Laptop, Wallet, etc.
    description: str
    location: str
    approximate_time: str  # Morning, Afternoon, Evening, Night

class ItemLike(BaseModel):
    item_id: str
    action: str  # "like" or "dislike"

class ClaimRequest(BaseModel):
    item_id: str
    message: Optional[str] = ""

class AIClaimRequest(BaseModel):
    item_id: str
    product_type: str
    description: str
    identification_marks: str
    lost_location: str
    approximate_date: str
    proof_image: Optional[str] = None  # Base64 or URL

class MessageCreate(BaseModel):
    recipient_id: str
    recipient_type: str  # "student" or "admin"
    content: str
    item_id: Optional[str] = None

class VerificationQuestion(BaseModel):
    claim_id: str
    question: str

class VerificationAnswer(BaseModel):
    claim_id: str
    answer: str

class DeleteReason(BaseModel):
    reason: str

class AdminNote(BaseModel):
    student_id: str
    note: str

class ClaimDecision(BaseModel):
    status: str  # "approved" or "rejected"
    notes: Optional[str] = ""

class FolderCreate(BaseModel):
    name: str
    type: str  # "department" or "year"
    parent_id: Optional[str] = None

class FolderRename(BaseModel):
    name: str

# ===================== HELPER FUNCTIONS =====================

def create_token(user_id: str, role: str, extra_data: dict = None) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc).timestamp() + 86400 * 7  # 7 days
    }
    if extra_data:
        payload.update(extra_data)
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = verify_token(token)
    return payload

async def require_admin(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

async def require_super_admin(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super Admin access required")
    return current_user

async def require_student(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Student access required")
    return current_user

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

async def auto_migrate_students_to_folders():
    """Auto-migrate existing students to folder structure"""
    try:
        # Check if migration already done
        migration_marker = await db.system_config.find_one({"key": "students_migrated_to_folders"})
        if migration_marker:
            logging.info("Students already migrated to folders")
            return
        
        # Get all unique departments and years
        students = await db.students.find({}, {"_id": 0, "department": 1, "year": 1}).to_list(10000)
        
        if not students:
            logging.info("No students to migrate")
            return
        
        dept_year_combos = {}
        for s in students:
            dept = s.get("department", "Unknown")
            year = s.get("year", "1")
            if dept not in dept_year_combos:
                dept_year_combos[dept] = set()
            dept_year_combos[dept].add(year)
        
        # Create department folders
        for dept in dept_year_combos.keys():
            existing_dept = await db.folders.find_one({"name": dept, "type": "department"})
            if not existing_dept:
                dept_folder = {
                    "id": str(uuid.uuid4()),
                    "name": dept,
                    "type": "department",
                    "parent_id": None,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "created_by": "system"
                }
                await db.folders.insert_one(dept_folder)
                logging.info(f"Created department folder: {dept}")
        
        # Create year folders and assign students
        for dept, years in dept_year_combos.items():
            dept_folder = await db.folders.find_one({"name": dept, "type": "department"})
            if not dept_folder:
                continue
            
            for year in years:
                year_name = f"{year}"
                existing_year = await db.folders.find_one({
                    "name": year_name,
                    "type": "year",
                    "parent_id": dept_folder["id"]
                })
                
                if not existing_year:
                    year_folder = {
                        "id": str(uuid.uuid4()),
                        "name": year_name,
                        "type": "year",
                        "parent_id": dept_folder["id"],
                        "created_at": datetime.now(timezone.utc).isoformat(),
                        "created_by": "system"
                    }
                    await db.folders.insert_one(year_folder)
                    year_folder_id = year_folder["id"]
                    logging.info(f"Created year folder: {dept} - {year_name}")
                else:
                    year_folder_id = existing_year["id"]
                
                # Update students
                await db.students.update_many(
                    {"department": dept, "year": str(year), "department_folder_id": {"$exists": False}},
                    {"$set": {
                        "department_folder_id": dept_folder["id"],
                        "year_folder_id": year_folder_id
                    }}
                )
        
        # Mark migration as complete
        await db.system_config.insert_one({
            "key": "students_migrated_to_folders",
            "value": True,
            "migrated_at": datetime.now(timezone.utc).isoformat()
        })
        
        logging.info("Student migration to folders completed successfully")
    
    except Exception as e:
        logging.error(f"Error during student migration: {str(e)}")

# ===================== STARTUP =====================

@app.on_event("startup")
async def startup_event():
    # Create super admin if not exists
    existing_admin = await db.admins.find_one({"role": "super_admin"})
    if not existing_admin:
        super_admin = {
            "id": str(uuid.uuid4()),
            "username": "superadmin",
            "password": hash_password("SuperAdmin@123"),
            "full_name": "Super Administrator",
            "role": "super_admin",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.admins.insert_one(super_admin)
        logging.info("Super admin created with default credentials")
    
    # Auto-migrate existing students to folder structure
    await auto_migrate_students_to_folders()

# ===================== PUBLIC LOBBY ENDPOINTS =====================

@api_router.get("/lobby/items")
async def get_lobby_items(item_type: Optional[str] = None):
    """Public endpoint - shows all active items with safe student info"""
    query = {"is_deleted": False, "status": "active"}
    
    if item_type and item_type in ["lost", "found"]:
        query["item_type"] = item_type
    
    items = await db.items.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    
    # Add safe student info (no roll number, phone, email)
    for item in items:
        student = await db.students.find_one(
            {"id": item["student_id"]},
            {"_id": 0, "full_name": 1, "department": 1, "year": 1}
        )
        if student:
            item["student"] = student
        else:
            item["student"] = {
                "full_name": "Anonymous",
                "department": "Unknown",
                "year": "N/A"
            }
        # Remove sensitive fields (including secret_message)
        item.pop("student_id", None)
        item.pop("secret_message", None)  # NEW: Never expose secret message publicly
    
    return items

@api_router.get("/lobby/items/lost")
async def get_lobby_lost_items():
    """Public endpoint - shows lost items only"""
    return await get_lobby_items(item_type="lost")

@api_router.get("/lobby/items/found")
async def get_lobby_found_items():
    """Public endpoint - shows found items only"""
    return await get_lobby_items(item_type="found")

# ===================== AUTH ROUTES =====================

@api_router.post("/auth/student/login")
async def student_login(data: StudentLogin):
    # Find student by roll number
    student = await db.students.find_one({
        "roll_number": data.roll_number
    }, {"_id": 0})
    
    if not student:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Compare DOB exactly as stored (DD-MM-YYYY format)
    if student.get("dob") != data.dob:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Remove sensitive fields before returning
    user_data = {k: v for k, v in student.items() if k not in ["admin_notes"]}
    
    token = create_token(student["id"], "student", {"roll_number": student["roll_number"]})
    return {"token": token, "user": user_data, "role": "student"}

@api_router.post("/auth/admin/login")
async def admin_login(data: AdminLogin):
    # DEBUG: Log incoming request
    logging.info(f"Admin login attempt - Username: '{data.username}', Password length: {len(data.password)}")
    
    admin = await db.admins.find_one({"username": data.username}, {"_id": 0})
    if not admin:
        logging.warning(f"Admin not found: '{data.username}'")
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # DEBUG: Test password
    is_valid = verify_password(data.password, admin["password"])
    logging.info(f"Password verification result: {is_valid}")
    
    if not is_valid:
        logging.warning(f"Password verification failed for: '{data.username}'")
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    admin_safe = {k: v for k, v in admin.items() if k != "password"}
    token = create_token(admin["id"], admin["role"], {"username": admin["username"]})
    logging.info(f"Login successful for: '{data.username}'")
    return {"token": token, "user": admin_safe, "role": admin["role"]}

@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    role = current_user.get("role")
    user_id = current_user.get("sub")
    
    if role == "student":
        user = await db.students.find_one({"id": user_id}, {"_id": 0})
    else:
        user = await db.admins.find_one({"id": user_id}, {"_id": 0, "password": 0})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"user": user, "role": role}

@api_router.post("/auth/admin/change-password")
async def change_admin_password(data: AdminPasswordChange, current_user: dict = Depends(require_admin)):
    admin = await db.admins.find_one({"id": current_user["sub"]})
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")
    
    if not verify_password(data.old_password, admin["password"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    new_hash = hash_password(data.new_password)
    await db.admins.update_one({"id": current_user["sub"]}, {"$set": {"password": new_hash}})
    return {"message": "Password changed successfully"}

# ===================== STUDENT MANAGEMENT =====================

@api_router.post("/students/upload-excel")
async def upload_students_excel(file: UploadFile = File(...), current_user: dict = Depends(require_admin)):
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Only Excel files are allowed")
    
    content = await file.read()
    df = pd.read_excel(BytesIO(content))
    
    # Validate required columns (case-insensitive)
    required_columns = ["Roll Number", "Full Name", "Department", "Year", "DOB", "Email", "Phone Number"]
    df_columns_lower = [col.strip().lower() for col in df.columns]
    required_lower = [col.lower() for col in required_columns]
    
    missing = [col for col in required_columns if col.lower() not in df_columns_lower]
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing required columns: {', '.join(missing)}")
    
    # Create column mapping (case-insensitive)
    column_map = {}
    for req_col in required_columns:
        for df_col in df.columns:
            if df_col.strip().lower() == req_col.lower():
                column_map[req_col] = df_col
                break
    
    added = 0
    skipped = 0
    errors = []
    total_rows = len(df)
    
    for idx, row in df.iterrows():
        try:
            roll_number = str(row[column_map["Roll Number"]]).strip()
            
            # Check for duplicate - skip if already exists
            existing = await db.students.find_one({"roll_number": roll_number, "is_deleted": False})
            if existing:
                skipped += 1
                continue
            
            # Handle DOB - support both DD-MM-YYYY and datetime objects
            dob_value = row[column_map["DOB"]]
            if isinstance(dob_value, datetime):
                # If pandas parsed it as datetime, convert to DD-MM-YYYY
                dob_str = dob_value.strftime("%d-%m-%Y")
            else:
                # Keep as string, ensure it's in DD-MM-YYYY format
                dob_str = str(dob_value).strip()
                # Validate format
                if dob_str and len(dob_str) == 10 and dob_str[2] == '-' and dob_str[5] == '-':
                    pass  # Format looks correct DD-MM-YYYY
                else:
                    errors.append(f"Row {idx + 2}: Invalid DOB format. Expected DD-MM-YYYY, got: {dob_str}")
                    continue
            
            # Get current timestamp for creation tracking
            now = datetime.now(timezone.utc)
            
            # Create student document with all required fields
            student = {
                "id": str(uuid.uuid4()),
                "roll_number": roll_number,
                "full_name": str(row[column_map["Full Name"]]).strip(),
                "department": str(row[column_map["Department"]]).strip(),
                "year": str(row[column_map["Year"]]).strip(),
                "dob": dob_str,  # Store in DD-MM-YYYY format
                "email": str(row[column_map["Email"]]).strip(),
                "phone_number": str(row[column_map["Phone Number"]]).strip(),
                "created_at": now.isoformat(),  # ISO datetime
                "created_date": now.strftime("%Y-%m-%d"),  # YYYY-MM-DD
                "created_time": now.strftime("%H:%M:%S")   # HH:MM:SS
            }
            
            await db.students.insert_one(student)
            added += 1
            
        except Exception as e:
            errors.append(f"Row {idx + 2}: {str(e)}")
    
    return {
        "message": f"Upload complete. Added: {added}, Skipped (duplicates): {skipped}",
        "total_rows": total_rows,
        "added": added,
        "skipped": skipped,
        "errors": errors
    }

@api_router.get("/students")
async def get_students(current_user: dict = Depends(require_admin)):
    """Get all students"""
    students = await db.students.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return students

@api_router.get("/students/{student_id}")
async def get_student(student_id: str, current_user: dict = Depends(require_admin)):
    student = await db.students.find_one({"id": student_id}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return student

@api_router.post("/students/{student_id}/admin-note")
async def add_admin_note(student_id: str, data: AdminNote, current_user: dict = Depends(require_admin)):
    student = await db.students.find_one({"id": student_id})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    note = {
        "id": str(uuid.uuid4()),
        "note": data.note,
        "added_by": current_user["sub"],
        "added_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.students.update_one({"id": student_id}, {"$push": {"admin_notes": note}})
    return {"message": "Note added successfully"}

@api_router.delete("/students/{student_id}")
async def delete_student(student_id: str, current_user: dict = Depends(require_admin)):
    """Hard delete student - permanently removes from database"""
    student = await db.students.find_one({"id": student_id})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Check if student has related items or claims
    has_items = await db.items.count_documents({"student_id": student_id}) > 0
    has_claims = await db.claims.count_documents({"claimant_id": student_id}) > 0
    
    if has_items or has_claims:
        raise HTTPException(
            status_code=400, 
            detail="Cannot delete student with active items or claims. Please resolve them first."
        )
    
    # Hard delete - permanently remove
    result = await db.students.delete_one({"id": student_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Student not found")
    
    return {"message": "Student deleted successfully"}

# ===================== STUDENT PROFILE =====================

@api_router.get("/profile")
async def get_profile(current_user: dict = Depends(require_student)):
    student = await db.students.find_one({"id": current_user["sub"]}, {"_id": 0, "admin_notes": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Profile not found")
    return student

@api_router.post("/profile/picture")
async def upload_profile_picture(file: UploadFile = File(...), current_user: dict = Depends(require_student)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are allowed")
    
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    filename = f"{current_user['sub']}.{ext}"
    filepath = PROFILES_DIR / filename
    
    with open(filepath, "wb") as f:
        content = await file.read()
        f.write(content)
    
    picture_url = f"/uploads/profiles/{filename}"
    await db.students.update_one({"id": current_user["sub"]}, {"$set": {"profile_picture": picture_url}})
    return {"message": "Profile picture updated", "picture_url": picture_url}

# ===================== ITEMS MANAGEMENT =====================

@api_router.post("/items")
async def create_item(
    item_type: str = Form(...),
    item_keyword: str = Form(...),
    description: str = Form(...),
    location: str = Form(...),
    approximate_time: str = Form(...),
    secret_message: str = Form(...),  # NEW: Mandatory secret identification message
    image: UploadFile = File(...),
    current_user: dict = Depends(require_student)
):
    if item_type not in ["lost", "found"]:
        raise HTTPException(status_code=400, detail="Item type must be 'lost' or 'found'")
    
    if not secret_message or not secret_message.strip():
        raise HTTPException(status_code=400, detail="Secret Identification Message is mandatory")
    
    if not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are allowed")
    
    item_id = str(uuid.uuid4())
    ext = image.filename.split(".")[-1] if "." in image.filename else "jpg"
    image_filename = f"{item_id}.{ext}"
    image_path = ITEMS_DIR / image_filename
    
    with open(image_path, "wb") as f:
        content = await image.read()
        f.write(content)
    
    # Auto-capture current date and time
    now = datetime.now(timezone.utc)
    
    item = {
        "id": item_id,
        "item_type": item_type,
        "item_keyword": item_keyword,
        "description": description,
        "location": location,
        "approximate_time": approximate_time,
        "secret_message": secret_message,  # NEW: Store secret message (NOT exposed publicly)
        "image_url": f"/uploads/items/{image_filename}",
        "student_id": current_user["sub"],
        "status": "active",  # active, claimed, resolved
        "is_deleted": False,
        "delete_reason": None,
        "deleted_at": None,
        "created_at": now.isoformat(),  # ISO datetime
        "created_date": now.strftime("%Y-%m-%d"),  # YYYY-MM-DD
        "created_time": now.strftime("%H:%M:%S"),  # HH:MM:SS
        "likes": 0,  # Like count
        "dislikes": 0,  # Dislike count
        "liked_by": [],  # List of user IDs who liked
        "disliked_by": []  # List of user IDs who disliked
    }
    
    await db.items.insert_one(item)
    
    # Log audit
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "action": "item_created",
        "item_id": item_id,
        "user_id": current_user["sub"],
        "user_role": "student",
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Item reported successfully", "item_id": item_id}

# ===================== GET ITEMS =====================

@api_router.get("/items")
async def get_items(
    item_type: Optional[str] = None,
    status: Optional[str] = None,
    include_deleted: bool = False,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    
    if current_user["role"] == "student":
        query["student_id"] = current_user["sub"]
        query["is_deleted"] = False
    elif not include_deleted:
        query["is_deleted"] = False
    
    if item_type:
        query["item_type"] = item_type
    if status:
        query["status"] = status
    
    items = await db.items.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Add student info for admin
    if current_user["role"] in ["admin", "super_admin"]:
        for item in items:
            student = await db.students.find_one({"id": item["student_id"]}, {"_id": 0, "full_name": 1, "roll_number": 1, "department": 1})
            item["student"] = student
    
    return items

@api_router.get("/items/my")
async def get_my_items(current_user: dict = Depends(require_student)):
    items = await db.items.find(
        {"student_id": current_user["sub"], "is_deleted": False},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return items

@api_router.get("/items/public")
async def get_public_items():
    """Public endpoint - shows recently found items without sensitive data"""
    items = await db.items.find(
        {"item_type": "found", "is_deleted": False, "status": "active"},
        {"_id": 0, "student_id": 0}
    ).sort("created_at", -1).to_list(50)
    return items

@api_router.get("/items/{item_id}")
async def get_item(item_id: str, current_user: dict = Depends(get_current_user)):
    item = await db.items.find_one({"id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    if current_user["role"] == "student" and item["student_id"] != current_user["sub"]:
        if item["is_deleted"]:
            raise HTTPException(status_code=404, detail="Item not found")
    
    if current_user["role"] in ["admin", "super_admin"]:
        student = await db.students.find_one({"id": item["student_id"]}, {"_id": 0, "full_name": 1, "roll_number": 1, "department": 1})
        item["student"] = student
    
    return item

@api_router.delete("/items/{item_id}")
async def soft_delete_item(item_id: str, data: DeleteReason, current_user: dict = Depends(require_student)):
    item = await db.items.find_one({"id": item_id})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    if item["student_id"] != current_user["sub"]:
        raise HTTPException(status_code=403, detail="You can only delete your own items")
    
    await db.items.update_one(
        {"id": item_id},
        {"$set": {
            "is_deleted": True,
            "delete_reason": data.reason,
            "deleted_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "action": "item_soft_deleted",
        "item_id": item_id,
        "user_id": current_user["sub"],
        "user_role": "student",
        "reason": data.reason,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Item deleted successfully"}

@api_router.get("/items/deleted/all")
async def get_deleted_items(current_user: dict = Depends(require_admin)):
    items = await db.items.find({"is_deleted": True}, {"_id": 0}).sort("deleted_at", -1).to_list(500)
    
    for item in items:
        student = await db.students.find_one({"id": item["student_id"]}, {"_id": 0, "full_name": 1, "roll_number": 1, "department": 1})
        item["student"] = student
    
    return items

@api_router.post("/items/{item_id}/restore")
async def restore_item(item_id: str, current_user: dict = Depends(require_admin)):
    result = await db.items.update_one(
        {"id": item_id, "is_deleted": True},
        {"$set": {"is_deleted": False, "delete_reason": None, "deleted_at": None}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Item not found or not deleted")
    
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "action": "item_restored",
        "item_id": item_id,
        "user_id": current_user["sub"],
        "user_role": current_user["role"],
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Item restored successfully"}

@api_router.delete("/items/{item_id}/permanent")
async def permanent_delete_item(item_id: str, current_user: dict = Depends(require_admin)):
    item = await db.items.find_one({"id": item_id})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Delete image file
    if item.get("image_url"):
        image_path = ROOT_DIR / item["image_url"].lstrip("/")
        if image_path.exists():
            image_path.unlink()
    
    await db.items.delete_one({"id": item_id})
    
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "action": "item_permanent_deleted",
        "item_id": item_id,
        "user_id": current_user["sub"],
        "user_role": current_user["role"],
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Item permanently deleted"}

@api_router.post("/items/{item_id}/like-dislike")
async def like_dislike_item(item_id: str, data: ItemLike, current_user: dict = Depends(get_current_user)):
    """Like or dislike an item"""
    item = await db.items.find_one({"id": item_id})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    user_id = current_user["sub"]
    action = data.action.lower()
    
    if action not in ["like", "dislike"]:
        raise HTTPException(status_code=400, detail="Action must be 'like' or 'dislike'")
    
    # Get current likes/dislikes lists
    liked_by = item.get("liked_by", [])
    disliked_by = item.get("disliked_by", [])
    
    # Remove from both lists first (user can only have one action)
    if user_id in liked_by:
        liked_by.remove(user_id)
    if user_id in disliked_by:
        disliked_by.remove(user_id)
    
    # Add to appropriate list
    if action == "like":
        liked_by.append(user_id)
    else:  # dislike
        disliked_by.append(user_id)
    
    # Update item in database
    await db.items.update_one(
        {"id": item_id},
        {"$set": {
            "likes": len(liked_by),
            "dislikes": len(disliked_by),
            "liked_by": liked_by,
            "disliked_by": disliked_by
        }}
    )
    
    return {
        "message": f"Item {action}d successfully",
        "likes": len(liked_by),
        "dislikes": len(disliked_by)
    }

@api_router.delete("/items/{item_id}/like-dislike")
async def remove_like_dislike(item_id: str, current_user: dict = Depends(get_current_user)):
    """Remove like/dislike from an item"""
    item = await db.items.find_one({"id": item_id})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    user_id = current_user["sub"]
    
    # Get current lists
    liked_by = item.get("liked_by", [])
    disliked_by = item.get("disliked_by", [])
    
    # Remove from both lists
    if user_id in liked_by:
        liked_by.remove(user_id)
    if user_id in disliked_by:
        disliked_by.remove(user_id)
    
    # Update item
    await db.items.update_one(
        {"id": item_id},
        {"$set": {
            "likes": len(liked_by),
            "dislikes": len(disliked_by),
            "liked_by": liked_by,
            "disliked_by": disliked_by
        }}
    )
    
    return {
        "message": "Like/Dislike removed successfully",
        "likes": len(liked_by),
        "dislikes": len(disliked_by)
    }


# ===================== CLAIMS =====================

@api_router.post("/claims")
async def create_claim(data: ClaimRequest, current_user: dict = Depends(require_student)):
    item = await db.items.find_one({"id": data.item_id, "is_deleted": False})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    existing_claim = await db.claims.find_one({
        "item_id": data.item_id,
        "claimant_id": current_user["sub"],
        "status": {"$in": ["pending", "under_review"]}
    })
    if existing_claim:
        raise HTTPException(status_code=400, detail="You already have a pending claim for this item")
    
    claim = {
        "id": str(uuid.uuid4()),
        "item_id": data.item_id,
        "claimant_id": current_user["sub"],
        "message": data.message,
        "status": "pending",  # pending, under_review, approved, rejected
        "verification_questions": [],
        "verification_answers": [],
        "admin_notes": "",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.claims.insert_one(claim)
    return {"message": "Claim submitted successfully", "claim_id": claim["id"]}

@api_router.post("/claims/ai-powered")
async def create_ai_powered_claim(
    item_id: str = Form(...),
    product_type: str = Form(...),
    description: str = Form(...),
    identification_marks: str = Form(...),
    lost_location: str = Form(...),
    approximate_date: str = Form(...),
    proof_image: UploadFile = File(None),
    current_user: dict = Depends(require_student)
):
    """Create a claim with AI similarity analysis"""
    # Get the item being claimed
    item = await db.items.find_one({"id": item_id, "is_deleted": False})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Check for existing pending claim
    existing_claim = await db.claims.find_one({
        "item_id": item_id,
        "claimant_id": current_user["sub"],
        "status": {"$in": ["pending", "under_review"]}
    })
    if existing_claim:
        raise HTTPException(status_code=400, detail="You already have a pending claim for this item")
    
    # Handle proof image upload
    proof_image_url = None
    if proof_image:
        if not proof_image.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="Only image files allowed for proof")
        
        proof_id = str(uuid.uuid4())
        ext = proof_image.filename.split(".")[-1] if "." in proof_image.filename else "jpg"
        proof_filename = f"claim_proof_{proof_id}.{ext}"
        proof_path = ITEMS_DIR / proof_filename
        
        with open(proof_path, "wb") as f:
            content = await proof_image.read()
            f.write(content)
        
        proof_image_url = f"/uploads/items/{proof_filename}"
    
    # Prepare data for AI analysis
    claim_data = {
        "product_type": product_type,
        "description": description,
        "identification_marks": identification_marks,
        "lost_location": lost_location,
        "approximate_date": approximate_date
    }
    
    item_data = {
        "item_keyword": item.get("item_keyword", ""),
        "description": item.get("description", ""),
        "location": item.get("location", ""),
        "approximate_time": item.get("approximate_time", ""),
        "created_date": item.get("created_date", "")
    }
    
    # Perform AI similarity analysis
    ai_analysis = {"match_percentage": 0, "reasoning": "AI analysis not available"}
    verification_questions = []
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if api_key:
            # First: Generate verification questions from secret_message
            secret_message = item.get("secret_message", "")
            
            if secret_message:
                try:
                    question_chat = LlmChat(
                        api_key=api_key,
                        session_id=f"verification_gen_{item_id}_{datetime.now().timestamp()}",
                        system_message="""You are generating ownership verification questions from secret identification messages.
                        Generate 2-5 specific questions that only the true owner would know.
                        Return ONLY a valid JSON array of strings.
                        Example: ["What color is the tear on the purse?", "Which side has the tear?"]"""
                    )
                    
                    question_prompt = f"""Generate 2-5 verification questions from this secret message:
"{secret_message}"

Return ONLY a JSON array of question strings. Be specific and detailed."""
                    
                    q_response = question_chat.send_user_message(UserMessage(content=question_prompt))
                    q_text = q_response.content.strip()
                    
                    if "```json" in q_text:
                        q_text = q_text.split("```json")[1].split("```")[0].strip()
                    elif "```" in q_text:
                        q_text = q_text.split("```")[1].split("```")[0].strip()
                    
                    verification_questions = json.loads(q_text)
                    logging.info(f"Generated {len(verification_questions)} verification questions")
                
                except Exception as qe:
                    logging.error(f"Question generation failed: {str(qe)}")
                    verification_questions = [
                        "Can you describe any unique features or marks on the item?",
                        "Where exactly did you lose this item?"
                    ]
            
            # Second: Perform similarity analysis
            chat = LlmChat(
                api_key=api_key,
                session_id=f"claim_analysis_{item_id}_{current_user['sub']}_{datetime.now().timestamp()}",
                system_message="""You are an AI assistant analyzing claim similarity for a campus lost & found system.
                Compare the student's claim details with the found item details.
                Analyze: product type, description match, identification marks, location proximity, date/time correlation.
                Return ONLY a valid JSON object with:
                {
                  "match_percentage": <number 0-100>,
                  "reasoning": "<brief explanation of similarity analysis>"
                }
                Be strict. Only give high scores (>80) for strong matches."""
            )
            
            prompt = f"""Analyze similarity between this claim and found item:

FOUND ITEM (Already Reported):
- Type: {item_data['item_keyword']}
- Description: {item_data['description']}
- Location: {item_data['location']}
- Time: {item_data['approximate_time']}
- Date: {item_data['created_date']}

STUDENT CLAIM:
- Product Type: {claim_data['product_type']}
- Description: {claim_data['description']}
- Identification Marks: {claim_data['identification_marks']}
- Lost Location: {claim_data['lost_location']}
- Approximate Date: {claim_data['approximate_date']}

Return JSON with match_percentage (0-100) and reasoning."""

            response = chat.send_user_message(UserMessage(content=prompt))
            response_text = response.content.strip()
            
            # Extract JSON from response
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0].strip()
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0].strip()
            
            ai_analysis = json.loads(response_text)
            logging.info(f"AI claim analysis: {ai_analysis}")
    
    except Exception as e:
        logging.error(f"AI analysis failed: {str(e)}")
        ai_analysis = {
            "match_percentage": 0,
            "reasoning": f"AI analysis unavailable: {str(e)}"
        }
        verification_questions = [
            "Can you describe any unique features or marks on the item?",
            "Where exactly did you lose this item?"
        ]
    
    # Create claim with AI analysis and verification questions
    claim = {
        "id": str(uuid.uuid4()),
        "item_id": item_id,
        "claimant_id": current_user["sub"],
        "claim_type": "ai_powered",
        "claim_data": claim_data,
        "proof_image_url": proof_image_url,
        "ai_analysis": ai_analysis,
        "verification_questions": verification_questions,  # Generated from secret_message
        "verification_answers": [],
        "status": "pending",
        "admin_notes": "",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.claims.insert_one(claim)
    
    return {
        "message": "AI-powered claim submitted successfully",
        "claim_id": claim["id"],
        "ai_analysis": ai_analysis,
        "verification_questions": verification_questions
    }

@api_router.get("/claims")
async def get_claims(status: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {}
    
    if current_user["role"] == "student":
        query["claimant_id"] = current_user["sub"]
    
    if status:
        query["status"] = status
    
    claims = await db.claims.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    
    # Enrich claims with item and claimant details
    for claim in claims:
        # Get item details (including secret_message for admins)
        item = await db.items.find_one({"id": claim["item_id"]}, {"_id": 0})
        if item:
            # For students, remove secret_message
            if current_user["role"] == "student":
                item.pop("secret_message", None)
            claim["item"] = item
        
        # Get claimant details (for admins only)
        if current_user["role"] in ["admin", "super_admin"]:
            claimant = await db.students.find_one({"id": claim["claimant_id"]}, {"_id": 0})
            if claimant:
                claim["claimant"] = claimant
    
    return claims

@api_router.get("/claims/{claim_id}")
async def get_claim(claim_id: str, current_user: dict = Depends(get_current_user)):
    claim = await db.claims.find_one({"id": claim_id}, {"_id": 0})
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    
    if current_user["role"] == "student" and claim["claimant_id"] != current_user["sub"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    item = await db.items.find_one({"id": claim["item_id"]}, {"_id": 0})
    claim["item"] = item
    
    if current_user["role"] in ["admin", "super_admin"]:
        claimant = await db.students.find_one({"id": claim["claimant_id"]}, {"_id": 0})
        claim["claimant"] = claimant
    
    return claim

@api_router.post("/claims/{claim_id}/verification-question")
async def add_verification_question(claim_id: str, data: VerificationQuestion, current_user: dict = Depends(require_admin)):
    claim = await db.claims.find_one({"id": claim_id})
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    
    question = {
        "id": str(uuid.uuid4()),
        "question": data.question,
        "asked_by": current_user["sub"],
        "asked_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.claims.update_one(
        {"id": claim_id},
        {
            "$push": {"verification_questions": question},
            "$set": {"status": "under_review"}
        }
    )
    
    # Send notification to student
    await db.messages.insert_one({
        "id": str(uuid.uuid4()),
        "sender_id": current_user["sub"],
        "sender_type": "admin",
        "recipient_id": claim["claimant_id"],
        "recipient_type": "student",
        "content": f"Verification question for your claim: {data.question}",
        "item_id": claim["item_id"],
        "claim_id": claim_id,
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Verification question sent"}

@api_router.post("/claims/{claim_id}/answer")
async def answer_verification(claim_id: str, data: VerificationAnswer, current_user: dict = Depends(require_student)):
    claim = await db.claims.find_one({"id": claim_id})
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    
    if claim["claimant_id"] != current_user["sub"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    answer = {
        "id": str(uuid.uuid4()),
        "answer": data.answer,
        "answered_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.claims.update_one({"id": claim_id}, {"$push": {"verification_answers": answer}})
    return {"message": "Answer submitted"}

@api_router.post("/claims/{claim_id}/decision")
async def claim_decision(claim_id: str, data: ClaimDecision, current_user: dict = Depends(require_admin)):
    if data.status not in ["approved", "rejected"]:
        raise HTTPException(status_code=400, detail="Status must be 'approved' or 'rejected'")
    
    claim = await db.claims.find_one({"id": claim_id})
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    
    await db.claims.update_one(
        {"id": claim_id},
        {"$set": {"status": data.status, "admin_notes": data.notes}}
    )
    
    # Update item status if approved
    if data.status == "approved":
        await db.items.update_one({"id": claim["item_id"]}, {"$set": {"status": "claimed"}})
    
    # Send notification
    status_text = "approved" if data.status == "approved" else "rejected"
    await db.messages.insert_one({
        "id": str(uuid.uuid4()),
        "sender_id": current_user["sub"],
        "sender_type": "admin",
        "recipient_id": claim["claimant_id"],
        "recipient_type": "student",
        "content": f"Your claim has been {status_text}. {data.notes or ''}",
        "item_id": claim["item_id"],
        "claim_id": claim_id,
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": f"Claim {status_text}"}

# ===================== MESSAGING =====================

@api_router.post("/messages")
async def send_message(data: MessageCreate, current_user: dict = Depends(require_admin)):
    message = {
        "id": str(uuid.uuid4()),
        "sender_id": current_user["sub"],
        "sender_type": current_user["role"],
        "recipient_id": data.recipient_id,
        "recipient_type": data.recipient_type,
        "content": data.content,
        "item_id": data.item_id,
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.messages.insert_one(message)
    return {"message": "Message sent", "message_id": message["id"]}

@api_router.get("/messages")
async def get_messages(current_user: dict = Depends(get_current_user)):
    if current_user["role"] == "student":
        query = {"recipient_id": current_user["sub"], "recipient_type": "student"}
    else:
        query = {"$or": [
            {"sender_id": current_user["sub"]},
            {"recipient_id": current_user["sub"]}
        ]}
    
    messages = await db.messages.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return messages

@api_router.get("/messages/unread-count")
async def get_unread_count(current_user: dict = Depends(get_current_user)):
    count = await db.messages.count_documents({
        "recipient_id": current_user["sub"],
        "is_read": False
    })
    return {"count": count}

@api_router.post("/messages/{message_id}/read")
async def mark_message_read(message_id: str, current_user: dict = Depends(get_current_user)):
    await db.messages.update_one(
        {"id": message_id, "recipient_id": current_user["sub"]},
        {"$set": {"is_read": True}}
    )
    return {"message": "Marked as read"}

@api_router.post("/messages/mark-all-read")
async def mark_all_read(current_user: dict = Depends(get_current_user)):
    await db.messages.update_many(
        {"recipient_id": current_user["sub"], "is_read": False},
        {"$set": {"is_read": True}}
    )
    return {"message": "All messages marked as read"}

# ===================== AI MATCHING =====================

@api_router.get("/ai/matches")
async def get_ai_matches(current_user: dict = Depends(require_admin)):
    """Get AI-suggested matches between lost and found items"""
    lost_items = await db.items.find(
        {"item_type": "lost", "is_deleted": False, "status": "active"},
        {"_id": 0}
    ).to_list(100)
    
    found_items = await db.items.find(
        {"item_type": "found", "is_deleted": False, "status": "active"},
        {"_id": 0}
    ).to_list(100)
    
    if not lost_items or not found_items:
        return {"matches": [], "message": "Not enough items to match"}
    
    matches = []
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            return {"matches": [], "message": "AI service not configured"}
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"matching_{datetime.now().timestamp()}",
            system_message="""You are an AI assistant helping match lost items with found items in a campus lost and found system.
            Compare items based on description, location, date, and time.
            Return ONLY valid JSON array with matches. Each match should have:
            - lost_id: ID of the lost item
            - found_id: ID of the found item
            - confidence: Score from 0 to 100
            - reason: Brief explanation of why they might match
            Only include matches with confidence >= 50."""
        ).with_model("openai", "gpt-5.2")
        
        lost_summary = [{"id": i["id"], "desc": i["description"], "loc": i["location"], "date": i["date"]} for i in lost_items[:20]]
        found_summary = [{"id": i["id"], "desc": i["description"], "loc": i["location"], "date": i["date"]} for i in found_items[:20]]
        
        prompt = f"""Match these lost items with found items:

LOST ITEMS:
{json.dumps(lost_summary, indent=2)}

FOUND ITEMS:
{json.dumps(found_summary, indent=2)}

Return ONLY a JSON array of matches with confidence scores."""
        
        response = await chat.send_message(UserMessage(text=prompt))
        
        # Parse response
        try:
            # Try to extract JSON from response
            import re
            json_match = re.search(r'\[.*\]', response, re.DOTALL)
            if json_match:
                matches_data = json.loads(json_match.group())
                for match in matches_data:
                    if match.get("confidence", 0) >= 50:
                        lost_item = next((i for i in lost_items if i["id"] == match["lost_id"]), None)
                        found_item = next((i for i in found_items if i["id"] == match["found_id"]), None)
                        if lost_item and found_item:
                            # Get student info
                            lost_student = await db.students.find_one({"id": lost_item["student_id"]}, {"_id": 0, "full_name": 1, "roll_number": 1})
                            found_student = await db.students.find_one({"id": found_item["student_id"]}, {"_id": 0, "full_name": 1, "roll_number": 1})
                            
                            matches.append({
                                "lost_item": {**lost_item, "student": lost_student},
                                "found_item": {**found_item, "student": found_student},
                                "confidence": match.get("confidence", 0),
                                "reason": match.get("reason", "")
                            })
        except json.JSONDecodeError:
            logging.error(f"Failed to parse AI response: {response}")
    
    except Exception as e:
        logging.error(f"AI matching error: {str(e)}")
        return {"matches": [], "message": f"AI matching temporarily unavailable"}
    
    # Sort by confidence
    matches.sort(key=lambda x: x["confidence"], reverse=True)
    return {"matches": matches}

# ===================== ADMIN MANAGEMENT =====================

@api_router.post("/admins")
async def create_admin(data: AdminCreate, current_user: dict = Depends(require_super_admin)):
    existing = await db.admins.find_one({"username": data.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    admin = {
        "id": str(uuid.uuid4()),
        "username": data.username,
        "password": hash_password(data.password),
        "full_name": data.full_name,
        "role": "admin",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user["sub"]
    }
    
    await db.admins.insert_one(admin)
    return {"message": "Admin created successfully", "admin_id": admin["id"]}

@api_router.get("/admins")
async def get_admins(current_user: dict = Depends(require_super_admin)):
    admins = await db.admins.find({}, {"_id": 0, "password": 0}).to_list(100)
    return admins

@api_router.delete("/admins/{admin_id}")
async def delete_admin(admin_id: str, current_user: dict = Depends(require_super_admin)):
    admin = await db.admins.find_one({"id": admin_id})
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")
    
    if admin["role"] == "super_admin":
        raise HTTPException(status_code=400, detail="Cannot delete super admin")
    
    await db.admins.delete_one({"id": admin_id})
    return {"message": "Admin deleted successfully"}

# ===================== FOLDER MANAGEMENT (SUPER ADMIN) =====================

@api_router.post("/folders")
async def create_folder(data: FolderCreate, current_user: dict = Depends(require_super_admin)):
    """Create a department or year folder with atomic operation"""
    if data.type not in ["department", "year"]:
        raise HTTPException(status_code=400, detail="Folder type must be 'department' or 'year'")
    
    # Validate parent for year folders
    if data.type == "year" and not data.parent_id:
        raise HTTPException(status_code=400, detail="Year folders must have a parent department")
    
    if data.type == "year" and data.parent_id:
        parent = await db.folders.find_one({"id": data.parent_id, "type": "department"})
        if not parent:
            raise HTTPException(status_code=404, detail="Parent department not found")
    
    try:
        # Check for duplicate with exact match
        existing = await db.folders.find_one({
            "name": data.name,
            "type": data.type,
            "parent_id": data.parent_id
        })
        if existing:
            # Return success with existing folder to avoid frontend confusion
            logging.warning(f"Folder already exists: {data.name} ({data.type})")
            return {
                "message": f"{data.type.capitalize()} folder already exists", 
                "folder_id": existing["id"], 
                "folder": existing,
                "already_exists": True
            }
        
        folder = {
            "id": str(uuid.uuid4()),
            "name": data.name,
            "type": data.type,
            "parent_id": data.parent_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": current_user["sub"]
        }
        
        # Atomic insert
        result = await db.folders.insert_one(folder)
        
        # Verify insertion
        if not result.inserted_id:
            raise HTTPException(status_code=500, detail="Failed to create folder")
        
        # Remove MongoDB _id from response
        folder.pop("_id", None)
        
        return {
            "message": f"{data.type.capitalize()} folder created successfully", 
            "folder_id": folder["id"], 
            "folder": folder,
            "already_exists": False
        }
    
    except Exception as e:
        logging.error(f"Error creating folder: {str(e)}")
        # Check again if folder was created during error
        check_folder = await db.folders.find_one({
            "name": data.name,
            "type": data.type,
            "parent_id": data.parent_id
        })
        if check_folder:
            check_folder.pop("_id", None)
            return {
                "message": f"{data.type.capitalize()} folder created", 
                "folder_id": check_folder["id"], 
                "folder": check_folder,
                "already_exists": True
            }
        raise HTTPException(status_code=500, detail=f"Failed to create folder: {str(e)}")

@api_router.get("/folders")
async def get_folders(current_user: dict = Depends(require_super_admin)):
    """Get all folders in hierarchical structure"""
    folders = await db.folders.find({}, {"_id": 0}).to_list(1000)
    
    # Build hierarchy
    departments = [f for f in folders if f["type"] == "department"]
    for dept in departments:
        dept["years"] = [f for f in folders if f["type"] == "year" and f["parent_id"] == dept["id"]]
        
        # Get student count for each year
        for year in dept["years"]:
            year["student_count"] = await db.students.count_documents({"year_folder_id": year["id"]})
    
    return departments

@api_router.get("/folders/{folder_id}")
async def get_folder(folder_id: str, current_user: dict = Depends(require_super_admin)):
    """Get folder details with students"""
    folder = await db.folders.find_one({"id": folder_id}, {"_id": 0})
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    
    if folder["type"] == "year":
        # Get parent department info
        if folder.get("parent_id"):
            parent_dept = await db.folders.find_one(
                {"id": folder["parent_id"], "type": "department"},
                {"_id": 0, "name": 1}
            )
            if parent_dept:
                folder["department_name"] = parent_dept["name"]
        
        # Get students in this year folder
        students = await db.students.find(
            {"year_folder_id": folder_id},
            {"_id": 0}
        ).to_list(1000)
        folder["students"] = students
        folder["student_count"] = len(students)
        
        # Get upload history
        uploads = await db.excel_uploads.find(
            {"year_folder_id": folder_id},
            {"_id": 0}
        }).sort("uploaded_at", -1).to_list(100)
        folder["uploads"] = uploads
    
    return folder

@api_router.put("/folders/{folder_id}")
async def rename_folder(folder_id: str, data: FolderRename, current_user: dict = Depends(require_super_admin)):
    """Rename folder and update all students if it's a year folder"""
    folder = await db.folders.find_one({"id": folder_id})
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    
    # Check for duplicate name
    existing = await db.folders.find_one({
        "name": data.name,
        "type": folder["type"],
        "parent_id": folder["parent_id"],
        "id": {"$ne": folder_id}
    })
    if existing:
        raise HTTPException(status_code=400, detail=f"A {folder['type']} folder with this name already exists")
    
    old_name = folder["name"]
    
    # Update folder name
    await db.folders.update_one({"id": folder_id}, {"$set": {"name": data.name}})
    
    # If it's a year folder, update all students
    if folder["type"] == "year":
        result = await db.students.update_many(
            {"year_folder_id": folder_id},
            {"$set": {"year": data.name}}
        )
        
        # Log the bulk update
        await db.audit_logs.insert_one({
            "id": str(uuid.uuid4()),
            "action": "year_folder_renamed",
            "folder_id": folder_id,
            "old_name": old_name,
            "new_name": data.name,
            "students_updated": result.modified_count,
            "admin_id": current_user["sub"],
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        return {
            "message": f"Folder renamed and {result.modified_count} students updated",
            "students_updated": result.modified_count
        }
    
    return {"message": "Folder renamed successfully"}

@api_router.delete("/folders/{folder_id}")
async def delete_folder(folder_id: str, current_user: dict = Depends(require_super_admin)):
    """Delete folder (with validation)"""
    folder = await db.folders.find_one({"id": folder_id})
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    
    # Check if it's a department with year folders
    if folder["type"] == "department":
        year_folders = await db.folders.count_documents({"parent_id": folder_id})
        if year_folders > 0:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete department with year folders. Delete year folders first."
            )
    
    # Check if it has students
    if folder["type"] == "year":
        student_count = await db.students.count_documents({"year_folder_id": folder_id})
        if student_count > 0:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete folder with {student_count} students. Move or delete students first."
            )
    
    await db.folders.delete_one({"id": folder_id})
    return {"message": "Folder deleted successfully"}

@api_router.post("/folders/{folder_id}/upload-excel")
async def upload_excel_to_folder(
    folder_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(require_super_admin)
):
    """Upload Excel file to a year folder - Department and Year come from folder structure"""
    # Validate folder
    year_folder = await db.folders.find_one({"id": folder_id, "type": "year"})
    if not year_folder:
        raise HTTPException(status_code=404, detail="Year folder not found")
    
    dept_folder = await db.folders.find_one({"id": year_folder["parent_id"], "type": "department"})
    if not dept_folder:
        raise HTTPException(status_code=404, detail="Department folder not found")
    
    department = dept_folder["name"]
    year = year_folder["name"]
    
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Only Excel files are allowed")
    
    content = await file.read()
    df = pd.read_excel(BytesIO(content))
    
    # Required columns (Department and Year are now OPTIONAL - folder takes priority)
    required_columns = ["Roll Number", "Full Name", "DOB", "Email", "Phone Number"]
    df_columns_lower = [col.strip().lower() for col in df.columns]
    required_lower = [col.lower() for col in required_columns]
    
    missing = [col for col in required_columns if col.lower() not in df_columns_lower]
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing required columns: {', '.join(missing)}")
    
    # Create column mapping
    column_map = {}
    for req_col in required_columns:
        for df_col in df.columns:
            if df_col.strip().lower() == req_col.lower():
                column_map[req_col] = df_col
                break
    
    added = 0
    skipped = 0
    errors = []
    
    for idx, row in df.iterrows():
        try:
            roll_number = str(row[column_map["Roll Number"]]).strip()
            
            # Check for duplicate
            existing = await db.students.find_one({"roll_number": roll_number})
            if existing:
                skipped += 1
                continue
            
            # Handle DOB
            dob_value = row[column_map["DOB"]]
            if isinstance(dob_value, datetime):
                dob_str = dob_value.strftime("%d-%m-%Y")
            else:
                dob_str = str(dob_value).strip()
                if dob_str and len(dob_str) == 10 and dob_str[2] == '-' and dob_str[5] == '-':
                    pass
                else:
                    errors.append(f"Row {idx + 2}: Invalid DOB format. Expected DD-MM-YYYY, got: {dob_str}")
                    continue
            
            now = datetime.now(timezone.utc)
            
            # Create student - Department and Year from FOLDER STRUCTURE
            student = {
                "id": str(uuid.uuid4()),
                "roll_number": roll_number,
                "full_name": str(row[column_map["Full Name"]]).strip(),
                "department": department,  # From folder
                "year": year,  # From folder
                "dob": dob_str,
                "email": str(row[column_map["Email"]]).strip(),
                "phone_number": str(row[column_map["Phone Number"]]).strip(),
                "department_folder_id": dept_folder["id"],
                "year_folder_id": year_folder["id"],
                "created_at": now.isoformat(),
                "created_date": now.strftime("%Y-%m-%d"),
                "created_time": now.strftime("%H:%M:%S")
            }
            
            await db.students.insert_one(student)
            added += 1
            
        except Exception as e:
            errors.append(f"Row {idx + 2}: {str(e)}")
    
    # Log upload
    upload_record = {
        "id": str(uuid.uuid4()),
        "filename": file.filename,
        "year_folder_id": folder_id,
        "department_folder_id": dept_folder["id"],
        "uploaded_by": current_user["sub"],
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "students_added": added,
        "students_skipped": skipped,
        "errors": errors
    }
    await db.excel_uploads.insert_one(upload_record)
    
    return {
        "message": f"Upload complete. Added: {added}, Skipped: {skipped}",
        "added": added,
        "skipped": skipped,
        "errors": errors,
        "department": department,
        "year": year
    }

# ===================== DASHBOARD STATS =====================

@api_router.get("/stats")
async def get_stats(current_user: dict = Depends(require_admin)):
    total_students = await db.students.count_documents({})
    total_lost = await db.items.count_documents({"item_type": "lost", "is_deleted": False})
    total_found = await db.items.count_documents({"item_type": "found", "is_deleted": False})
    pending_claims = await db.claims.count_documents({"status": {"$in": ["pending", "under_review"]}})
    resolved_items = await db.items.count_documents({"status": "claimed"})
    deleted_items = await db.items.count_documents({"is_deleted": True})
    
    return {
        "total_students": total_students,
        "total_lost": total_lost,
        "total_found": total_found,
        "pending_claims": pending_claims,
        "resolved_items": resolved_items,
        "deleted_items": deleted_items
    }

# ===================== HEALTH CHECK =====================

@api_router.get("/")
async def root():
    return {"message": "Campus Lost & Found API", "status": "running"}

@api_router.get("/health")
async def health():
    return {"status": "healthy"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

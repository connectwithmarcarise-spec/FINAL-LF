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
    reason: str  # MANDATORY reason for decision (accountability)

# NEW: "I Found This" response for LOST items (separate from Claims)
class FoundResponse(BaseModel):
    item_id: str
    message: str
    found_location: str
    found_time: str

# NEW: Item status transition model
class ItemStatusUpdate(BaseModel):
    status: str  # Valid transitions enforced
    reason: Optional[str] = None

# Item lifecycle states:
# LOST: reported -> found_reported -> claimed -> returned -> archived
# FOUND: reported -> claimed -> returned -> archived
VALID_ITEM_STATUSES = ["reported", "found_reported", "claimed", "returned", "archived"]

# AI Confidence bands (NOT percentages)
# AUDIT FIX: Added INSUFFICIENT band for weak evidence cases
CONFIDENCE_BANDS = {
    "INSUFFICIENT": (0, 20),   # Not enough information to assess
    "LOW": (21, 45),           # Many mismatches or weak evidence
    "MEDIUM": (46, 70),        # Some matches, needs admin verification
    "HIGH": (71, 100)          # Strong evidence alignment
}

def get_confidence_band(score: int) -> str:
    """Convert numeric score to confidence band - AI is ADVISORY ONLY"""
    for band, (low, high) in CONFIDENCE_BANDS.items():
        if low <= score <= high:
            return band
    return "INSUFFICIENT"

def assess_input_quality(text: str) -> dict:
    """
    AUDIT FIX: Assess the quality of user input to penalize vague descriptions.
    Returns quality score and flags.
    """
    if not text:
        return {"score": 0, "quality": "missing", "flags": ["No input provided"]}
    
    text = text.strip().lower()
    flags = []
    score = 50  # Start neutral
    
    # Generic terms that indicate low quality
    generic_terms = ["phone", "laptop", "wallet", "keys", "bag", "bottle", "book", 
                     "black", "white", "silver", "blue", "red", "small", "big"]
    
    # Specific indicators that suggest genuine ownership
    specific_indicators = ["serial", "crack", "scratch", "dent", "sticker", "engraved",
                          "torn", "faded", "broken", "chipped", "custom", "unique",
                          "model", "version", "year", "brand"]
    
    # Check for generic-only descriptions
    words = text.split()
    generic_count = sum(1 for word in words if word in generic_terms)
    specific_count = sum(1 for word in words if any(ind in word for ind in specific_indicators))
    
    if len(words) < 5:
        score -= 20
        flags.append("Very short description")
    
    if generic_count > 0 and specific_count == 0:
        score -= 30
        flags.append("Only generic terms, no unique identifiers")
    
    if specific_count >= 2:
        score += 20
        flags.append("Contains specific ownership indicators")
    
    # Length bonus for detailed descriptions
    if len(text) > 100:
        score += 10
    
    quality = "high" if score >= 70 else "medium" if score >= 40 else "low"
    
    return {
        "score": max(0, min(100, score)),
        "quality": quality,
        "flags": flags
    }

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
    
    # Create indexes for better query performance
    await db.students.create_index([("department", 1), ("year", 1)])
    await db.items.create_index([("status", 1), ("item_type", 1)])
    await db.claims.create_index([("item_id", 1), ("status", 1)])
    await db.audit_logs.create_index([("timestamp", -1)])

# ===================== HEALTH CHECK =====================

@api_router.get("/health")
async def health_check():
    """Health check endpoint for monitoring"""
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# ===================== LOBBY ENDPOINTS (REQUIRES AUTHENTICATION) =====================
# DESIGN FIX: No public browsing before login - lobby requires authentication

@api_router.get("/lobby/items")
async def get_lobby_items(
    item_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user)  # REQUIRES AUTH
):
    """
    AUTHENTICATED endpoint - shows all items with safe student info.
    DESIGN FIX: Lobby requires login - no public browsing.
    """
    # Include both "active" and "reported" statuses for backward compatibility
    query = {"is_deleted": False, "status": {"$in": ["active", "reported", "found_reported"]}}
    
    if item_type and item_type in ["lost", "found"]:
        query["item_type"] = item_type
    
    items = await db.items.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    
    # Get current user ID for ownership check
    current_user_id = current_user.get("sub")
    current_user_role = current_user.get("role", "student")
    
    # Add safe student info (no roll number, phone, email)
    for item in items:
        original_student_id = item.get("student_id")
        
        student = await db.students.find_one(
            {"id": original_student_id},
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
        
        # FIX A: Include ownership flag so frontend can hide invalid actions
        item["is_owner"] = (original_student_id == current_user_id) if current_user_role == "student" else False
        
        # Remove sensitive fields
        item.pop("student_id", None)
        item.pop("secret_message", None)
        
        # Add action hints based on item type AND ownership
        if item["is_owner"]:
            # Owner sees different options
            item["available_action"] = "manage"
            item["action_label"] = "You reported this"
        elif item["item_type"] == "lost":
            item["available_action"] = "found_response"
            item["action_label"] = "I Found This"
        else:
            item["available_action"] = "claim"
            item["action_label"] = "Claim This Item"
    
    return items

@api_router.get("/lobby/items/lost")
async def get_lobby_lost_items(current_user: dict = Depends(get_current_user)):
    """Authenticated endpoint - shows lost items only"""
    return await get_lobby_items(item_type="lost", current_user=current_user)

@api_router.get("/lobby/items/found")
async def get_lobby_found_items(current_user: dict = Depends(get_current_user)):
    """Authenticated endpoint - shows found items only"""
    return await get_lobby_items(item_type="found", current_user=current_user)

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

# NEW: Get students by department and year (CONTEXT SWITCH)
@api_router.get("/students/by-context")
async def get_students_by_context(
    department: str = Query(..., description="Department name"),
    year: str = Query(..., description="Year (1, 2, 3, 4)"),
    current_user: dict = Depends(require_admin)
):
    """
    Get students filtered by department and year.
    This is the CONTEXT SWITCH - admin must select dept+year first before any operations.
    """
    query = {"department": department, "year": year}
    students = await db.students.find(query, {"_id": 0}).sort("full_name", 1).to_list(1000)
    total_count = await db.students.count_documents(query)
    
    return {
        "department": department,
        "year": year,
        "total_count": total_count,
        "students": students
    }

# NEW: Get available departments and years for context selection
@api_router.get("/students/contexts")
async def get_student_contexts(current_user: dict = Depends(require_admin)):
    """Get unique department + year combinations with counts"""
    pipeline = [
        {
            "$group": {
                "_id": {"department": "$department", "year": "$year"},
                "count": {"$sum": 1}
            }
        },
        {"$sort": {"_id.department": 1, "_id.year": 1}}
    ]
    
    contexts = await db.students.aggregate(pipeline).to_list(100)
    
    # Structure as department -> years -> count
    result = {}
    for ctx in contexts:
        dept = ctx["_id"]["department"]
        year = ctx["_id"]["year"]
        count = ctx["count"]
        
        if dept not in result:
            result[dept] = {"years": {}, "total": 0}
        result[dept]["years"][year] = count
        result[dept]["total"] += count
    
    return result

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
    secret_message: str = Form(...),  # Mandatory secret identification message
    image: Optional[UploadFile] = File(None),  # CHANGED: Image is now OPTIONAL
    current_user: dict = Depends(require_student)
):
    if item_type not in ["lost", "found"]:
        raise HTTPException(status_code=400, detail="Item type must be 'lost' or 'found'")
    
    if not secret_message or not secret_message.strip():
        raise HTTPException(status_code=400, detail="Secret Identification Message is mandatory")
    
    # Validate description quality - penalize vague inputs
    if len(description.strip()) < 20:
        raise HTTPException(
            status_code=400, 
            detail="Description too short. Please provide detailed description (minimum 20 characters)"
        )
    
    item_id = str(uuid.uuid4())
    image_url = None
    
    # Handle optional image upload
    if image and image.filename:
        if not image.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="Only image files are allowed")
        
        ext = image.filename.split(".")[-1] if "." in image.filename else "jpg"
        image_filename = f"{item_id}.{ext}"
        image_path = ITEMS_DIR / image_filename
        
        with open(image_path, "wb") as f:
            content = await image.read()
            f.write(content)
        
        image_url = f"/uploads/items/{image_filename}"
    
    # Auto-capture current date and time
    now = datetime.now(timezone.utc)
    
    # NEW: Proper item lifecycle status
    # LOST items start as "reported" - waiting for someone to find
    # FOUND items start as "reported" - waiting for owner to claim
    initial_status = "reported"
    
    item = {
        "id": item_id,
        "item_type": item_type,
        "item_keyword": item_keyword,
        "description": description,
        "location": location,
        "approximate_time": approximate_time,
        "secret_message": secret_message,  # NOT exposed publicly
        "image_url": image_url,  # Can be null if no image uploaded
        "student_id": current_user["sub"],
        "status": initial_status,  # NEW: reported -> found_reported -> claimed -> returned -> archived
        "is_deleted": False,
        "delete_reason": None,
        "deleted_at": None,
        "created_at": now.isoformat(),
        "created_date": now.strftime("%Y-%m-%d"),
        "created_time": now.strftime("%H:%M:%S"),
        "likes": 0,
        "dislikes": 0,
        "liked_by": [],
        "disliked_by": [],
        "status_history": [{
            "status": initial_status,
            "changed_at": now.isoformat(),
            "changed_by": current_user["sub"],
            "reason": "Item reported"
        }]
    }
    
    await db.items.insert_one(item)
    
    # Log audit
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "action": "item_created",
        "item_id": item_id,
        "item_type": item_type,
        "user_id": current_user["sub"],
        "user_role": "student",
        "details": {"has_image": image_url is not None},
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


# ===================== "I FOUND THIS" RESPONSES (For LOST items only) =====================
# This is SEPARATE from Claims - used when someone finds a LOST item

@api_router.post("/items/{item_id}/found-response")
async def submit_found_response(
    item_id: str,
    data: FoundResponse,
    current_user: dict = Depends(require_student)
):
    """
    Submit 'I Found This Item' response for a LOST item.
    This is NOT a claim - it's a response to help return a lost item to its owner.
    Claims are ONLY for FOUND items (ownership verification).
    """
    item = await db.items.find_one({"id": item_id, "is_deleted": False})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # SEMANTIC FIX: Found responses only for LOST items
    if item["item_type"] != "lost":
        raise HTTPException(
            status_code=400, 
            detail="'I Found This' is only for LOST items. Use 'Claim' for FOUND items."
        )
    
    # Prevent self-response (owner can't "find" their own lost item)
    if item["student_id"] == current_user["sub"]:
        raise HTTPException(
            status_code=400,
            detail="You cannot respond to your own lost item report"
        )
    
    # Check for duplicate responses from same user
    existing_response = await db.found_responses.find_one({
        "item_id": item_id,
        "responder_id": current_user["sub"],
        "status": {"$in": ["pending", "under_review"]}
    })
    if existing_response:
        raise HTTPException(status_code=400, detail="You already submitted a response for this item")
    
    # Rate limiting: Max 3 responses per user per day
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    responses_today = await db.found_responses.count_documents({
        "responder_id": current_user["sub"],
        "created_at": {"$gte": today_start.isoformat()}
    })
    if responses_today >= 3:
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded. Maximum 3 'Found' responses per day."
        )
    
    now = datetime.now(timezone.utc)
    found_response = {
        "id": str(uuid.uuid4()),
        "item_id": item_id,
        "responder_id": current_user["sub"],
        "message": data.message,
        "found_location": data.found_location,
        "found_time": data.found_time,
        "status": "pending",  # pending, verified, rejected
        "admin_notes": "",
        "created_at": now.isoformat()
    }
    
    await db.found_responses.insert_one(found_response)
    
    # Update item status to "found_reported" (lifecycle transition)
    await db.items.update_one(
        {"id": item_id},
        {
            "$set": {"status": "found_reported"},
            "$push": {"status_history": {
                "status": "found_reported",
                "changed_at": now.isoformat(),
                "changed_by": current_user["sub"],
                "reason": "Someone reported finding this item"
            }}
        }
    )
    
    # Audit log
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "action": "found_response_submitted",
        "item_id": item_id,
        "user_id": current_user["sub"],
        "timestamp": now.isoformat()
    })
    
    return {
        "message": "Thank you! Your response has been submitted. The item owner will be notified.",
        "response_id": found_response["id"]
    }

@api_router.get("/items/{item_id}/found-responses")
async def get_found_responses(item_id: str, current_user: dict = Depends(get_current_user)):
    """Get all 'Found' responses for a LOST item"""
    item = await db.items.find_one({"id": item_id})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Only owner or admin can see responses
    if current_user["role"] == "student" and item["student_id"] != current_user["sub"]:
        raise HTTPException(status_code=403, detail="Only the item owner can view responses")
    
    responses = await db.found_responses.find(
        {"item_id": item_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Enrich with responder info
    for resp in responses:
        responder = await db.students.find_one(
            {"id": resp["responder_id"]},
            {"_id": 0, "full_name": 1, "department": 1, "year": 1}
        )
        resp["responder"] = responder
    
    return responses


# ===================== CLAIMS (ONLY for FOUND items - ownership verification) =====================

@api_router.post("/claims")
async def create_claim(data: ClaimRequest, current_user: dict = Depends(require_student)):
    """
    Create a claim for a FOUND item.
    SEMANTIC FIX: Claims are ONLY for FOUND items (ownership verification).
    For LOST items, use 'I Found This' response instead.
    """
    item = await db.items.find_one({"id": data.item_id, "is_deleted": False})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # SEMANTIC FIX: Claims only for FOUND items
    if item["item_type"] != "found":
        raise HTTPException(
            status_code=400, 
            detail="Claims are only for FOUND items. For LOST items, use 'I Found This' button."
        )
    
    # Prevent owner from claiming their own found item report
    if item["student_id"] == current_user["sub"]:
        raise HTTPException(
            status_code=400,
            detail="You cannot claim an item you reported as found"
        )
    
    existing_claim = await db.claims.find_one({
        "item_id": data.item_id,
        "claimant_id": current_user["sub"],
        "status": {"$in": ["pending", "under_review"]}
    })
    if existing_claim:
        raise HTTPException(status_code=400, detail="You already have a pending claim for this item")
    
    # Rate limiting: Max 5 claims per user per day
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    claims_today = await db.claims.count_documents({
        "claimant_id": current_user["sub"],
        "created_at": {"$gte": today_start.isoformat()}
    })
    if claims_today >= 5:
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded. Maximum 5 claims per day."
        )
    
    # Check total pending claims on this item (prevent claim flooding)
    total_pending = await db.claims.count_documents({
        "item_id": data.item_id,
        "status": {"$in": ["pending", "under_review"]}
    })
    if total_pending >= 10:
        raise HTTPException(
            status_code=400,
            detail="This item has too many pending claims. Please wait for admin review."
        )
    
    claim = {
        "id": str(uuid.uuid4()),
        "item_id": data.item_id,
        "claimant_id": current_user["sub"],
        "claim_type": "ownership",  # Always ownership for FOUND items
        "message": data.message,
        "status": "pending",
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
    """
    Create a claim with AI advisory analysis.
    IMPORTANT: AI is ADVISORY ONLY - it does NOT approve/reject claims.
    AI returns confidence bands (LOW/MEDIUM/HIGH), NOT percentages.
    This is ONLY for FOUND items (ownership verification).
    """
    # Get the item being claimed
    item = await db.items.find_one({"id": item_id, "is_deleted": False})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # SEMANTIC FIX: AI claims only for FOUND items
    if item["item_type"] != "found":
        raise HTTPException(
            status_code=400, 
            detail="AI-powered claims are only for FOUND items. For LOST items, use 'I Found This' instead."
        )
    
    # Prevent owner from claiming their own found item report
    if item["student_id"] == current_user["sub"]:
        raise HTTPException(
            status_code=400,
            detail="You cannot claim an item you reported as found"
        )
    
    # Check for existing pending claim
    existing_claim = await db.claims.find_one({
        "item_id": item_id,
        "claimant_id": current_user["sub"],
        "status": {"$in": ["pending", "under_review"]}
    })
    if existing_claim:
        raise HTTPException(status_code=400, detail="You already have a pending claim for this item")
    
    # Rate limiting: Max 5 claims per user per day
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    claims_today = await db.claims.count_documents({
        "claimant_id": current_user["sub"],
        "created_at": {"$gte": today_start.isoformat()}
    })
    if claims_today >= 5:
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded. Maximum 5 claims per day."
        )
    
    # PENALIZE VAGUE INPUTS - minimum quality requirements
    if len(description.strip()) < 15:
        raise HTTPException(
            status_code=400,
            detail="Description too vague. Please provide more details (minimum 15 characters)."
        )
    if len(identification_marks.strip()) < 10:
        raise HTTPException(
            status_code=400,
            detail="Identification marks too vague. Please describe unique features."
        )
    
    # AUDIT FIX: Check item status - can't claim archived/returned items
    if item.get("status") in ["claimed", "returned", "archived"]:
        raise HTTPException(
            status_code=400,
            detail=f"This item is already {item.get('status')}. It cannot be claimed."
        )
    
    # Handle proof image upload (OPTIONAL)
    proof_image_url = None
    has_proof_image = False
    if proof_image and proof_image.filename:
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
        has_proof_image = True
    
    # AUDIT FIX: Assess input quality before AI analysis
    description_quality = assess_input_quality(description)
    marks_quality = assess_input_quality(identification_marks)
    
    # Prepare STRUCTURED data for AI analysis
    claim_data = {
        "product_type": product_type,
        "description": description,
        "identification_marks": identification_marks,
        "lost_location": lost_location,
        "approximate_date": approximate_date,
        "has_proof_image": has_proof_image,
        "description_quality": description_quality,
        "marks_quality": marks_quality
    }
    
    item_data = {
        "item_keyword": item.get("item_keyword", ""),
        "description": item.get("description", ""),
        "location": item.get("location", ""),
        "approximate_time": item.get("approximate_time", ""),
        "created_date": item.get("created_date", ""),
        "has_image": bool(item.get("image_url")),
        "secret_message": item.get("secret_message", "")  # AUDIT FIX: Include for comparison
    }
    
    # AUDIT FIX: Build structured AI analysis with proper explainability
    ai_analysis = {
        "confidence_band": "INSUFFICIENT",
        "reasoning": "AI analysis not available",
        "what_matched": [],
        "what_partially_matched": [],
        "what_did_not_match": [],
        "missing_information": [],
        "inconsistencies": [],
        "input_quality_flags": description_quality["flags"] + marks_quality["flags"],
        "advisory_note": "⚠️ This is ADVISORY ONLY. The admin will review and make the final decision."
    }
    verification_questions = []
    internal_score = 0
    
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
                        Focus on details that cannot be guessed by looking at the item.
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
            
            # AUDIT FIX: Comprehensive AI system prompt with structured analysis
            ai_system_prompt = """You are an AI ADVISORY assistant for a campus lost & found verification system.

CRITICAL RULES:
1. You are ADVISORY ONLY - you NEVER approve or reject claims
2. You NEVER make final decisions - only human admins do that
3. You MUST be conservative - when in doubt, say INSUFFICIENT
4. You MUST NOT hallucinate or assume facts not provided
5. You MUST explicitly state what information is missing

CONFIDENCE BANDS (NOT percentages):
- INSUFFICIENT: Not enough information to assess. Use when:
  * Key details are missing
  * Descriptions are too generic (just "phone" or "black bag")
  * Time/location cannot be verified
  * No unique identifiers provided
  
- LOW: Significant mismatches or weak evidence. Use when:
  * Product types don't match
  * Locations are inconsistent
  * Dates don't align
  * Generic descriptions only

- MEDIUM: Some alignment but verification needed. Use when:
  * Product types match
  * Some details align
  * But unique identifiers not confirmed
  * Or some minor inconsistencies exist

- HIGH: Strong evidence alignment. Use ONLY when:
  * Product type matches exactly
  * Specific unique identifiers mentioned
  * Location and time are consistent
  * Description details align well

GENERIC TERMS TO PENALIZE:
- Colors alone (black, white, silver) are NOT unique
- Basic product names (phone, laptop, wallet) are NOT unique
- Common locations (library, cafeteria) need specifics

EVIDENCE TO VALUE:
- Serial numbers, model numbers
- Specific damage (scratches, cracks, tears)
- Custom modifications (stickers, cases, engravings)
- Unusual features

Return ONLY valid JSON with this EXACT structure:
{
  "internal_score": <0-100>,
  "confidence_band": "INSUFFICIENT" | "LOW" | "MEDIUM" | "HIGH",
  "reasoning": "<human-readable summary for admin>",
  "what_matched": ["list of matching details"],
  "what_partially_matched": ["details that somewhat align"],
  "what_did_not_match": ["conflicting or mismatched details"],
  "missing_information": ["what would help verify ownership"],
  "inconsistencies": ["time/location/description conflicts"],
  "recommendation_for_admin": "<specific next steps for admin>"
}"""

            chat = LlmChat(
                api_key=api_key,
                session_id=f"claim_analysis_{item_id}_{current_user['sub']}_{datetime.now().timestamp()}",
                system_message=ai_system_prompt
            )
            
            # AUDIT FIX: Structured prompt with all context
            prompt = f"""Analyze this ownership claim. Be STRICT and CONSERVATIVE.

=== FOUND ITEM (Reported by finder) ===
- Item Type: {item_data['item_keyword']}
- Description: {item_data['description']}
- Found Location: {item_data['location']}
- Found Time: {item_data['approximate_time']}
- Date Reported: {item_data['created_date']}
- Item Has Image: {item_data['has_image']}
- Secret Identifier (from owner): {item_data['secret_message'][:50] + '...' if len(item_data['secret_message']) > 50 else item_data['secret_message']}

=== CLAIM DETAILS (From claimant) ===
- Claimed Product Type: {claim_data['product_type']}
- Claimant's Description: {claim_data['description']}
- Unique Marks Claimed: {claim_data['identification_marks']}
- Where Claimant Lost It: {claim_data['lost_location']}
- When Claimant Lost It: {claim_data['approximate_date']}
- Proof Image Provided: {claim_data['has_proof_image']}

=== INPUT QUALITY FLAGS ===
Description Quality: {claim_data['description_quality']['quality']} - {', '.join(claim_data['description_quality']['flags']) or 'No flags'}
Identification Marks Quality: {claim_data['marks_quality']['quality']} - {', '.join(claim_data['marks_quality']['flags']) or 'No flags'}

INSTRUCTIONS:
1. Compare product types - do they match?
2. Check if locations are geographically consistent
3. Check if times/dates are consistent
4. Evaluate uniqueness of identification marks
5. Check if claimant's details align with secret identifier hints
6. Penalize generic descriptions heavily
7. Be CONSERVATIVE - use INSUFFICIENT if evidence is weak

Return the JSON analysis."""

            response = chat.send_user_message(UserMessage(content=prompt))
            response_text = response.content.strip()
            
            # Extract JSON from response
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0].strip()
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0].strip()
            
            parsed_response = json.loads(response_text)
            internal_score = parsed_response.get("internal_score", 0)
            
            # AUDIT FIX: Always use our band calculation for consistency
            confidence_band = get_confidence_band(internal_score)
            
            # AUDIT FIX: Build comprehensive explainable analysis
            ai_analysis = {
                "confidence_band": confidence_band,
                "reasoning": parsed_response.get("reasoning", "Analysis completed"),
                "what_matched": parsed_response.get("what_matched", []),
                "what_partially_matched": parsed_response.get("what_partially_matched", []),
                "what_did_not_match": parsed_response.get("what_did_not_match", []),
                "missing_information": parsed_response.get("missing_information", []),
                "inconsistencies": parsed_response.get("inconsistencies", []),
                "input_quality_flags": claim_data['description_quality']['flags'] + claim_data['marks_quality']['flags'],
                "recommendation_for_admin": parsed_response.get("recommendation_for_admin", "Please review manually"),
                "advisory_note": "⚠️ This is ADVISORY ONLY. The admin will review and make the final decision."
            }
            logging.info(f"AI claim analysis: confidence={confidence_band}, score={internal_score}")
    
    except Exception as e:
        logging.error(f"AI analysis failed: {str(e)}")
        # AUDIT FIX: Safe fallback with INSUFFICIENT confidence (not LOW)
        ai_analysis = {
            "confidence_band": "INSUFFICIENT",
            "reasoning": "AI analysis could not be completed. Manual review required.",
            "what_matched": [],
            "what_partially_matched": [],
            "what_did_not_match": [],
            "missing_information": ["AI analysis unavailable - please verify all details manually"],
            "inconsistencies": [],
            "input_quality_flags": claim_data['description_quality']['flags'] + claim_data['marks_quality']['flags'],
            "recommendation_for_admin": "AI analysis failed. Please conduct full manual verification.",
            "advisory_note": "⚠️ AI analysis failed. Admin must verify manually."
        }
        verification_questions = [
            "Can you describe any unique features or marks on the item?",
            "Where exactly did you lose this item?",
            "What was in the item if it's a bag/wallet?"
        ]
    
    # Create claim with AI advisory analysis
    claim = {
        "id": str(uuid.uuid4()),
        "item_id": item_id,
        "claimant_id": current_user["sub"],
        "claim_type": "ai_powered",
        "claim_data": claim_data,
        "proof_image_url": proof_image_url,
        "ai_analysis": ai_analysis,
        "ai_internal_score": internal_score,  # Hidden from students, visible to admins
        "verification_questions": verification_questions,
        "verification_answers": [],
        "status": "pending",
        "admin_notes": "",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.claims.insert_one(claim)
    
    # Audit log
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "action": "ai_claim_submitted",
        "item_id": item_id,
        "claim_id": claim["id"],
        "user_id": current_user["sub"],
        "ai_confidence": ai_analysis["confidence_band"],
        "ai_failed": ai_analysis["confidence_band"] == "INSUFFICIENT" and "failed" in ai_analysis.get("reasoning", "").lower(),
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "message": "Claim submitted for admin review",
        "claim_id": claim["id"],
        "ai_analysis": ai_analysis,  # Shows confidence band, NOT percentage
        "verification_questions": verification_questions,
        "note": "Your claim will be reviewed by an admin. AI analysis is advisory only."
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
    """
    Admin decision on a claim.
    ACCOUNTABILITY: Reason is MANDATORY for audit trail.
    """
    if data.status not in ["approved", "rejected"]:
        raise HTTPException(status_code=400, detail="Status must be 'approved' or 'rejected'")
    
    # ACCOUNTABILITY: Reason is MANDATORY
    if not data.reason or not data.reason.strip():
        raise HTTPException(
            status_code=400, 
            detail="Reason is mandatory for claim decisions (accountability requirement)"
        )
    
    if len(data.reason.strip()) < 10:
        raise HTTPException(
            status_code=400,
            detail="Please provide a meaningful reason (minimum 10 characters)"
        )
    
    claim = await db.claims.find_one({"id": claim_id})
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    
    now = datetime.now(timezone.utc)
    
    await db.claims.update_one(
        {"id": claim_id},
        {"$set": {
            "status": data.status,
            "admin_notes": data.reason,
            "decided_by": current_user["sub"],
            "decided_at": now.isoformat()
        }}
    )
    
    # Update item status if approved (lifecycle transition)
    if data.status == "approved":
        await db.items.update_one(
            {"id": claim["item_id"]},
            {
                "$set": {"status": "claimed"},
                "$push": {"status_history": {
                    "status": "claimed",
                    "changed_at": now.isoformat(),
                    "changed_by": current_user["sub"],
                    "reason": f"Claim approved: {data.reason}"
                }}
            }
        )
    
    # AUDIT LOG - mandatory for admin accountability
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "action": f"claim_{data.status}",
        "claim_id": claim_id,
        "item_id": claim["item_id"],
        "admin_id": current_user["sub"],
        "admin_role": current_user["role"],
        "reason": data.reason,
        "timestamp": now.isoformat()
    })
    
    # Send notification
    status_text = "approved" if data.status == "approved" else "rejected"
    await db.messages.insert_one({
        "id": str(uuid.uuid4()),
        "sender_id": current_user["sub"],
        "sender_type": "admin",
        "recipient_id": claim["claimant_id"],
        "recipient_type": "student",
        "content": f"Your claim has been {status_text}. Reason: {data.reason}",
        "item_id": claim["item_id"],
        "claim_id": claim_id,
        "is_read": False,
        "created_at": now.isoformat()
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
        "student_reaction": None,  # NEW: null, "thumbs_up", "thumbs_down"
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": None
    }
    
    await db.messages.insert_one(message)
    return {"message": "Message sent", "message_id": message["id"]}

@api_router.put("/messages/{message_id}")
async def edit_message(message_id: str, content: str, current_user: dict = Depends(require_admin)):
    """Admin can edit their own messages"""
    message = await db.messages.find_one({"id": message_id, "sender_id": current_user["sub"]})
    if not message:
        raise HTTPException(status_code=404, detail="Message not found or you don't have permission")
    
    await db.messages.update_one(
        {"id": message_id},
        {"$set": {
            "content": content,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    return {"message": "Message updated successfully"}

@api_router.delete("/messages/{message_id}")
async def delete_message(message_id: str, current_user: dict = Depends(require_admin)):
    """Admin can delete their own messages"""
    message = await db.messages.find_one({"id": message_id, "sender_id": current_user["sub"]})
    if not message:
        raise HTTPException(status_code=404, detail="Message not found or you don't have permission")
    
    await db.messages.delete_one({"id": message_id})
    return {"message": "Message deleted successfully"}

@api_router.post("/messages/{message_id}/react")
async def react_to_message(message_id: str, reaction: str, current_user: dict = Depends(require_student)):
    """Student can react to admin messages with thumbs up or thumbs down"""
    if reaction not in ["thumbs_up", "thumbs_down"]:
        raise HTTPException(status_code=400, detail="Invalid reaction. Use 'thumbs_up' or 'thumbs_down'")
    
    message = await db.messages.find_one({"id": message_id, "recipient_id": current_user["sub"]})
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    await db.messages.update_one(
        {"id": message_id},
        {"$set": {"student_reaction": reaction}}
    )
    return {"message": "Reaction added successfully", "reaction": reaction}

# FIX B: Admin endpoint to see message delivery status
@api_router.get("/messages/admin/sent")
async def get_admin_sent_messages(current_user: dict = Depends(require_admin)):
    """
    Admin can see all messages they sent with seen status.
    Shows whether and when students viewed each message.
    """
    messages = await db.messages.find(
        {"sender_id": current_user["sub"], "sender_type": "admin"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    
    # Enrich with recipient info and seen status
    for msg in messages:
        student = await db.students.find_one(
            {"id": msg["recipient_id"]},
            {"_id": 0, "full_name": 1, "roll_number": 1, "department": 1}
        )
        msg["recipient"] = student or {"full_name": "Unknown Student"}
        
        # Explicit seen status for admin
        msg["delivery_status"] = {
            "sent_at": msg.get("created_at"),
            "is_seen": msg.get("is_read", False),
            "seen_at": msg.get("seen_at"),
            "reaction": msg.get("student_reaction")
        }
    
    return messages

@api_router.get("/messages")
async def get_messages(current_user: dict = Depends(get_current_user)):
    """
    Get messages for current user.
    FIX B: Auto-mark messages as seen when fetched (real-world behavior).
    """
    if current_user["role"] == "student":
        query = {"recipient_id": current_user["sub"], "recipient_type": "student"}
    else:
        query = {"$or": [
            {"sender_id": current_user["sub"]},
            {"recipient_id": current_user["sub"]}
        ]}
    
    messages = await db.messages.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    
    # FIX B: AUTO-MARK AS SEEN when student views messages
    # This is real-world behavior - viewing = seen
    now = datetime.now(timezone.utc)
    if current_user["role"] == "student":
        unread_ids = [m["id"] for m in messages if not m.get("is_read")]
        if unread_ids:
            await db.messages.update_many(
                {"id": {"$in": unread_ids}, "recipient_id": current_user["sub"]},
                {
                    "$set": {
                        "is_read": True,
                        "seen_at": now.isoformat()  # FIX B: Track when seen
                    }
                }
            )
            # Update local data for response
            for msg in messages:
                if msg["id"] in unread_ids:
                    msg["is_read"] = True
                    msg["seen_at"] = now.isoformat()
    
    # Enrich messages with sender and recipient details
    for msg in messages:
        # Get sender details
        if msg["sender_type"] in ["admin", "super_admin"]:
            sender = await db.admins.find_one({"id": msg["sender_id"]}, {"_id": 0, "username": 1, "full_name": 1, "role": 1})
            if sender:
                msg["sender"] = sender
        else:
            sender = await db.students.find_one({"id": msg["sender_id"]}, {"_id": 0, "full_name": 1, "roll_number": 1})
            if sender:
                msg["sender"] = sender
        
        # Get recipient details
        if msg["recipient_type"] == "student":
            recipient = await db.students.find_one({"id": msg["recipient_id"]}, {"_id": 0, "full_name": 1, "roll_number": 1})
            if recipient:
                msg["recipient"] = recipient
        else:
            recipient = await db.admins.find_one({"id": msg["recipient_id"]}, {"_id": 0, "username": 1, "full_name": 1})
            if recipient:
                msg["recipient"] = recipient
    
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
# FIX #5: AI Matching was always returning 0% because status query was wrong

def calculate_text_similarity(text1: str, text2: str) -> float:
    """Calculate text similarity using word overlap - fallback when AI unavailable"""
    if not text1 or not text2:
        return 0.0
    
    words1 = set(text1.lower().split())
    words2 = set(text2.lower().split())
    
    if not words1 or not words2:
        return 0.0
    
    # Jaccard similarity
    intersection = len(words1.intersection(words2))
    union = len(words1.union(words2))
    
    return (intersection / union) * 100 if union > 0 else 0.0

def calculate_location_similarity(loc1: str, loc2: str) -> float:
    """Calculate location similarity"""
    if not loc1 or not loc2:
        return 0.0
    
    loc1 = loc1.lower()
    loc2 = loc2.lower()
    
    # Common campus locations
    campus_areas = ["library", "cafeteria", "canteen", "lab", "classroom", "ground", "parking", 
                   "entrance", "gate", "block", "floor", "corridor", "auditorium", "hostel"]
    
    # Check if same area
    for area in campus_areas:
        if area in loc1 and area in loc2:
            return 70.0
    
    # Word overlap
    return calculate_text_similarity(loc1, loc2)

def calculate_match_score(lost_item: dict, found_item: dict) -> dict:
    """Calculate match score between lost and found items using multiple criteria"""
    scores = {}
    reasons = []
    
    # 1. Item keyword/category match (30% weight)
    lost_keyword = (lost_item.get("item_keyword") or "").lower()
    found_keyword = (found_item.get("item_keyword") or "").lower()
    
    if lost_keyword and found_keyword:
        if lost_keyword == found_keyword:
            scores["category"] = 100
            reasons.append(f"Category match: {found_keyword}")
        elif lost_keyword in found_keyword or found_keyword in lost_keyword:
            scores["category"] = 70
            reasons.append(f"Partial category match")
        else:
            scores["category"] = 0
    else:
        scores["category"] = 0
    
    # 2. Description similarity (35% weight)
    lost_desc = lost_item.get("description", "")
    found_desc = found_item.get("description", "")
    
    desc_score = calculate_text_similarity(lost_desc, found_desc)
    scores["description"] = desc_score
    if desc_score > 40:
        reasons.append(f"Description similarity: {desc_score:.0f}%")
    
    # 3. Location proximity (20% weight)
    lost_loc = lost_item.get("location", "")
    found_loc = found_item.get("location", "")
    
    loc_score = calculate_location_similarity(lost_loc, found_loc)
    scores["location"] = loc_score
    if loc_score > 30:
        reasons.append(f"Location proximity: {found_loc}")
    
    # 4. Date/Time closeness (15% weight)
    lost_date = lost_item.get("created_date", "")
    found_date = found_item.get("created_date", "")
    
    if lost_date and found_date:
        try:
            from datetime import datetime as dt
            lost_dt = dt.strptime(lost_date, "%Y-%m-%d")
            found_dt = dt.strptime(found_date, "%Y-%m-%d")
            days_diff = abs((found_dt - lost_dt).days)
            
            if days_diff == 0:
                scores["date"] = 100
                reasons.append("Same day")
            elif days_diff <= 1:
                scores["date"] = 80
            elif days_diff <= 3:
                scores["date"] = 60
            elif days_diff <= 7:
                scores["date"] = 40
            else:
                scores["date"] = max(0, 20 - days_diff)
        except:
            scores["date"] = 0
    else:
        scores["date"] = 0
    
    # Calculate weighted total
    total = (
        scores.get("category", 0) * 0.30 +
        scores.get("description", 0) * 0.35 +
        scores.get("location", 0) * 0.20 +
        scores.get("date", 0) * 0.15
    )
    
    return {
        "confidence": round(total, 1),
        "scores": scores,
        "reason": " | ".join(reasons) if reasons else "Low similarity"
    }

@api_router.get("/ai/matches")
async def get_ai_matches(current_user: dict = Depends(require_admin)):
    """
    Get AI-suggested matches between lost and found items.
    FIX #5: Fixed query - items are stored with status "reported" NOT "active"
    Now includes fallback algorithm when AI is unavailable.
    """
    # FIX: Query uses correct statuses - "reported", "active", "found_reported"
    lost_items = await db.items.find(
        {
            "item_type": "lost", 
            "is_deleted": False, 
            "status": {"$in": ["reported", "active", "found_reported"]}
        },
        {"_id": 0}
    ).to_list(100)
    
    found_items = await db.items.find(
        {
            "item_type": "found", 
            "is_deleted": False, 
            "status": {"$in": ["reported", "active"]}
        },
        {"_id": 0}
    ).to_list(100)
    
    if not lost_items or not found_items:
        return {"matches": [], "message": "Not enough items to match"}
    
    matches = []
    ai_available = False
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if api_key:
            ai_available = True
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
                Only include matches with confidence >= 30."""
            )
            
            # Prepare item summaries with all available data
            lost_summary = [{
                "id": i["id"], 
                "keyword": i.get("item_keyword", ""),
                "desc": i.get("description", ""), 
                "loc": i.get("location", ""), 
                "date": i.get("created_date", ""),
                "time": i.get("approximate_time", "")
            } for i in lost_items[:20]]
            
            found_summary = [{
                "id": i["id"], 
                "keyword": i.get("item_keyword", ""),
                "desc": i.get("description", ""), 
                "loc": i.get("location", ""), 
                "date": i.get("created_date", ""),
                "time": i.get("approximate_time", "")
            } for i in found_items[:20]]
            
            prompt = f"""Match these lost items with found items based on similarity:

LOST ITEMS:
{json.dumps(lost_summary, indent=2)}

FOUND ITEMS:
{json.dumps(found_summary, indent=2)}

Consider: item type/keyword, description details, location proximity, and date closeness.
Return ONLY a JSON array of matches with confidence scores (0-100)."""
            
            response = chat.send_user_message(UserMessage(content=prompt))
            response_text = response.content if hasattr(response, 'content') else str(response)
            
            # Parse response
            import re
            json_match = re.search(r'\[.*\]', response_text, re.DOTALL)
            if json_match:
                matches_data = json.loads(json_match.group())
                for match in matches_data:
                    if match.get("confidence", 0) >= 30:
                        lost_item = next((i for i in lost_items if i["id"] == match["lost_id"]), None)
                        found_item = next((i for i in found_items if i["id"] == match["found_id"]), None)
                        if lost_item and found_item:
                            lost_student = await db.students.find_one(
                                {"id": lost_item["student_id"]}, 
                                {"_id": 0, "full_name": 1, "roll_number": 1}
                            )
                            found_student = await db.students.find_one(
                                {"id": found_item["student_id"]}, 
                                {"_id": 0, "full_name": 1, "roll_number": 1}
                            )
                            
                            matches.append({
                                "lost_item": {**lost_item, "student": lost_student},
                                "found_item": {**found_item, "student": found_student},
                                "confidence": match.get("confidence", 0),
                                "reason": match.get("reason", "AI-detected similarity"),
                                "ai_powered": True
                            })
    
    except Exception as e:
        logging.error(f"AI matching error: {str(e)}")
        ai_available = False
    
    # FALLBACK: Use algorithmic matching if AI failed or no matches found
    if not matches:
        logging.info("Using algorithmic matching fallback")
        for lost_item in lost_items[:20]:
            for found_item in found_items[:20]:
                result = calculate_match_score(lost_item, found_item)
                
                if result["confidence"] >= 30:
                    lost_student = await db.students.find_one(
                        {"id": lost_item["student_id"]}, 
                        {"_id": 0, "full_name": 1, "roll_number": 1}
                    )
                    found_student = await db.students.find_one(
                        {"id": found_item["student_id"]}, 
                        {"_id": 0, "full_name": 1, "roll_number": 1}
                    )
                    
                    matches.append({
                        "lost_item": {**lost_item, "student": lost_student},
                        "found_item": {**found_item, "student": found_student},
                        "confidence": result["confidence"],
                        "reason": result["reason"],
                        "ai_powered": False
                    })
    
    # Sort by confidence and limit results
    matches.sort(key=lambda x: x["confidence"], reverse=True)
    matches = matches[:20]  # Limit to top 20 matches
    
    return {
        "matches": matches,
        "message": f"Found {len(matches)} potential matches" if matches else "No matches found",
        "ai_available": ai_available
    }

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
        ).sort("uploaded_at", -1).to_list(100)
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

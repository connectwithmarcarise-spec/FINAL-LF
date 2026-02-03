# API Documentation - New & Updated Endpoints

## 🆕 NEW ENDPOINTS

### 1. Public Lobby Endpoints (No Authentication Required)

#### Get All Active Items (Public)
```http
GET /api/lobby/items
```
**Query Parameters:**
- `item_type` (optional): "lost" or "found"

**Response:**
```json
[
  {
    "id": "uuid",
    "item_type": "lost",
    "item_keyword": "Phone",
    "description": "Black iPhone 15 with blue case",
    "location": "Library 2nd Floor",
    "approximate_time": "Morning (6 AM – 12 PM)",
    "image_url": "/uploads/items/uuid.jpg",
    "status": "active",
    "created_at": "2026-02-03T10:30:00Z",
    "created_date": "2026-02-03",
    "created_time": "10:30:00",
    "likes": 5,
    "dislikes": 0,
    "student": {
      "full_name": "John Doe",
      "department": "CSE",
      "year": "3"
    }
  }
]
```

**Note:** `student_id`, `roll_number`, `email`, `phone_number` are **NOT included**.

---

#### Get Lost Items Only (Public)
```http
GET /api/lobby/items/lost
```
Same response format as above, filtered for `item_type: "lost"`

---

#### Get Found Items Only (Public)
```http
GET /api/lobby/items/found
```
Same response format as above, filtered for `item_type: "found"`

---

### 2. Folder Management Endpoints (Super Admin Only)

#### Create Folder
```http
POST /api/folders
Authorization: Bearer {super_admin_token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "CSE",
  "type": "department",
  "parent_id": null
}
```
OR
```json
{
  "name": "2",
  "type": "year",
  "parent_id": "dept_folder_uuid"
}
```

**Response:**
```json
{
  "message": "Department folder created",
  "folder_id": "uuid",
  "folder": {
    "id": "uuid",
    "name": "CSE",
    "type": "department",
    "parent_id": null,
    "created_at": "2026-02-03T10:00:00Z",
    "created_by": "admin_uuid"
  }
}
```

---

#### Get All Folders (Hierarchical)
```http
GET /api/folders
Authorization: Bearer {super_admin_token}
```

**Response:**
```json
[
  {
    "id": "dept_uuid",
    "name": "CSE",
    "type": "department",
    "parent_id": null,
    "created_at": "2026-02-03T10:00:00Z",
    "created_by": "admin_uuid",
    "years": [
      {
        "id": "year_uuid",
        "name": "1",
        "type": "year",
        "parent_id": "dept_uuid",
        "student_count": 25,
        "created_at": "2026-02-03T10:05:00Z"
      }
    ]
  }
]
```

---

#### Get Folder Details
```http
GET /api/folders/{folder_id}
Authorization: Bearer {super_admin_token}
```

**Response (for year folder):**
```json
{
  "id": "year_uuid",
  "name": "1",
  "type": "year",
  "parent_id": "dept_uuid",
  "created_at": "2026-02-03T10:05:00Z",
  "student_count": 25,
  "students": [
    {
      "id": "student_uuid",
      "roll_number": "112723205099",
      "full_name": "John Doe",
      "department": "CSE",
      "year": "1",
      "dob": "15-06-2005",
      "email": "john@spcet.ac.in",
      "phone_number": "9876543210",
      "department_folder_id": "dept_uuid",
      "year_folder_id": "year_uuid",
      "created_at": "2026-02-03T10:10:00Z"
    }
  ],
  "uploads": [
    {
      "id": "upload_uuid",
      "filename": "students_batch1.xlsx",
      "year_folder_id": "year_uuid",
      "department_folder_id": "dept_uuid",
      "uploaded_by": "admin_uuid",
      "uploaded_at": "2026-02-03T10:10:00Z",
      "students_added": 25,
      "students_skipped": 2,
      "errors": []
    }
  ]
}
```

---

#### Rename Folder (Bulk Update for Year Folders)
```http
PUT /api/folders/{folder_id}
Authorization: Bearer {super_admin_token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "2"
}
```

**Response (for year folder):**
```json
{
  "message": "Folder renamed and 25 students updated",
  "students_updated": 25
}
```

**Response (for department folder):**
```json
{
  "message": "Folder renamed successfully"
}
```

**Note:** If it's a year folder, ALL students with `year_folder_id = folder_id` will have their `year` field updated to the new name. An audit log is created.

---

#### Delete Folder
```http
DELETE /api/folders/{folder_id}
Authorization: Bearer {super_admin_token}
```

**Response:**
```json
{
  "message": "Folder deleted successfully"
}
```

**Error Cases:**
- `400`: Department has year folders (delete years first)
- `400`: Year folder has students (move/delete students first)

---

#### Upload Excel to Year Folder
```http
POST /api/folders/{year_folder_id}/upload-excel
Authorization: Bearer {super_admin_token}
Content-Type: multipart/form-data
```

**Request Body (Form Data):**
- `file`: Excel file (.xlsx or .xls)

**Excel Format:**
| Roll Number  | Full Name | DOB        | Email            | Phone Number |
|--------------|-----------|------------|------------------|--------------|
| 112723205099 | John Doe  | 15-06-2005 | john@spcet.ac.in | 9876543210   |

**Note:** `Department` and `Year` columns are **OPTIONAL** and **IGNORED**. Values come from folder structure.

**Response:**
```json
{
  "message": "Upload complete. Added: 25, Skipped: 2",
  "added": 25,
  "skipped": 2,
  "errors": [
    "Row 5: Invalid DOB format"
  ],
  "department": "CSE",
  "year": "1"
}
```

---

## 🔄 UPDATED ENDPOINTS

### Create Item (Student)
```http
POST /api/items
Authorization: Bearer {student_token}
Content-Type: multipart/form-data
```

**Updated Request Body:**
```
item_type: "lost" | "found"
item_keyword: "Phone" | "Laptop" | ... | "Custom keyword"
description: "Detailed description"
location: "Library 2nd Floor"
approximate_time: "Morning (6 AM – 12 PM)" | "Afternoon (12 PM – 6 PM)" | ...
image: [file]
```

**Removed Fields:**
- ❌ `date` (auto-generated)
- ❌ `time` (auto-generated)

**New Fields:**
- ✅ `item_keyword`
- ✅ `approximate_time`

**Response:**
```json
{
  "message": "Item reported successfully",
  "item_id": "uuid"
}
```

**Created Item Structure:**
```json
{
  "id": "uuid",
  "item_type": "lost",
  "item_keyword": "Phone",
  "description": "Black iPhone 15",
  "location": "Library",
  "approximate_time": "Morning (6 AM – 12 PM)",
  "image_url": "/uploads/items/uuid.jpg",
  "student_id": "student_uuid",
  "status": "active",
  "is_deleted": false,
  "created_at": "2026-02-03T10:30:00Z",   // Auto-generated
  "created_date": "2026-02-03",            // Auto-generated
  "created_time": "10:30:00",              // Auto-generated
  "likes": 0,
  "dislikes": 0,
  "liked_by": [],
  "disliked_by": []
}
```

---

## 📊 NEW DATABASE COLLECTIONS

### folders
```json
{
  "id": "uuid",
  "name": "CSE" | "1" | "2" | ...,
  "type": "department" | "year",
  "parent_id": "uuid" | null,
  "created_at": "ISO datetime",
  "created_by": "admin_uuid"
}
```

### excel_uploads
```json
{
  "id": "uuid",
  "filename": "students.xlsx",
  "year_folder_id": "uuid",
  "department_folder_id": "uuid",
  "uploaded_by": "admin_uuid",
  "uploaded_at": "ISO datetime",
  "students_added": 25,
  "students_skipped": 2,
  "errors": ["Row 5: Invalid DOB"]
}
```

### system_config
```json
{
  "key": "students_migrated_to_folders",
  "value": true,
  "migrated_at": "ISO datetime"
}
```

---

## 🔄 UPDATED DATABASE SCHEMAS

### students (Updated)
```json
{
  "id": "uuid",
  "roll_number": "112723205099",
  "full_name": "John Doe",
  "department": "CSE",
  "year": "1",
  "dob": "15-06-2005",
  "email": "john@spcet.ac.in",
  "phone_number": "9876543210",
  "department_folder_id": "uuid",          // NEW
  "year_folder_id": "uuid",                // NEW
  "profile_picture": null,
  "admin_notes": [],
  "created_at": "ISO datetime",
  "created_date": "YYYY-MM-DD",
  "created_time": "HH:MM:SS"
}
```

### items (Updated)
```json
{
  "id": "uuid",
  "item_type": "lost" | "found",
  "item_keyword": "Phone",                 // NEW
  "description": "Black iPhone 15",
  "location": "Library",
  "approximate_time": "Morning (6 AM – 12 PM)",  // NEW
  "image_url": "/uploads/items/uuid.jpg",
  "student_id": "student_uuid",
  "status": "active" | "claimed" | "resolved",
  "is_deleted": false,
  "delete_reason": null,
  "deleted_at": null,
  "created_at": "ISO datetime",
  "created_date": "YYYY-MM-DD",
  "created_time": "HH:MM:SS",
  "likes": 0,
  "dislikes": 0,
  "liked_by": [],
  "disliked_by": []
}
```

---

## 🔐 AUTHENTICATION & AUTHORIZATION

### Public Endpoints (No Auth):
- `GET /api/lobby/items`
- `GET /api/lobby/items/lost`
- `GET /api/lobby/items/found`

### Student Endpoints:
- `POST /api/items` (updated with new fields)

### Admin Endpoints:
- All existing admin endpoints remain unchanged

### Super Admin Only:
- `POST /api/folders`
- `GET /api/folders`
- `GET /api/folders/{id}`
- `PUT /api/folders/{id}`
- `DELETE /api/folders/{id}`
- `POST /api/folders/{id}/upload-excel`

---

## 📝 MIGRATION NOTES

### Auto-Migration on Startup:
On first backend startup after deployment, the system will:
1. Check if migration marker exists in `system_config`
2. If not, create department folders from existing student data
3. Create year folders under each department
4. Assign all existing students to appropriate folders
5. Mark migration as complete

**Migration is idempotent** - safe to run multiple times.

---

## 🧪 TESTING EXAMPLES

### Test Public Lobby:
```bash
curl -X GET https://repo-inspector-75.preview.emergentagent.com/api/lobby/items
```

### Test Create Folder (Super Admin):
```bash
curl -X POST https://repo-inspector-75.preview.emergentagent.com/api/folders \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "CSE", "type": "department"}'
```

### Test Excel Upload to Folder:
```bash
curl -X POST https://repo-inspector-75.preview.emergentagent.com/api/folders/YEAR_FOLDER_UUID/upload-excel \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_TOKEN" \
  -F "file=@students.xlsx"
```

### Test Create Item with New Fields:
```bash
curl -X POST https://repo-inspector-75.preview.emergentagent.com/api/items \
  -H "Authorization: Bearer YOUR_STUDENT_TOKEN" \
  -F "item_type=lost" \
  -F "item_keyword=Phone" \
  -F "description=Black iPhone 15" \
  -F "location=Library" \
  -F "approximate_time=Morning (6 AM – 12 PM)" \
  -F "image=@phone.jpg"
```

---

## ⚠️ BREAKING CHANGES

### For Item Creation:
- `date` field removed (auto-generated)
- `time` field removed (auto-generated)
- `item_keyword` field required
- `approximate_time` field required

### For Excel Upload:
- `Department` column now optional (ignored if present)
- `Year` column now optional (ignored if present)
- Values come from folder structure instead

---

## 🔄 BACKWARD COMPATIBILITY

All existing endpoints continue to work:
- Student login
- Admin login
- Claims management
- Messages
- AI matching
- Student CRUD operations
- Old item creation (if not using new form)

---

**API Version:** 2.0  
**Last Updated:** February 3, 2026

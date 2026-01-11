# Campus Lost and Found Management System PRD

## Project Overview
**Institution**: ST. PETERS COLLEGE OF ENGINEERING AND TECHNOLOGY (AN AUTONOMOUS)
**System Type**: Full-stack web application for campus lost and found item management
**Tech Stack**: React (Frontend) + FastAPI (Backend) + MongoDB (Database)
**AI Integration**: OpenAI GPT-5.2 for item matching

---

## User Personas & Roles

### 1. Student
- Login via Roll Number + Date of Birth
- Can report lost/found items with images
- Can view their submitted items and claim status
- Can delete their own items (soft delete)
- Can view notifications from admin
- Can update profile picture only

### 2. Admin
- Login via Username + Password
- Can upload student data via Excel
- Can manage all items (lost/found)
- Can view AI-suggested matches
- Can process claims (approve/reject)
- Can send verification questions to students
- Can send messages to students
- Can view/restore/permanently delete items
- Can change own password

### 3. Super Admin
- All Admin privileges
- Can create/delete other admin accounts
- Default credentials: superadmin / SuperAdmin@123

### 4. Public Display
- Read-only access to found items
- No login required
- No sensitive student data exposed

---

## Core Requirements

### Authentication
- [x] Student login with Roll Number + DOB
- [x] Admin login with Username + Password
- [x] JWT-based authentication
- [x] Role-based access control

### Student Features
- [x] Dashboard with recent items and claims
- [x] Report lost item with image, description, location, date, time
- [x] Report found item with image, description, location, date, time
- [x] View own items and their status
- [x] Soft delete with reason (visible to admin)
- [x] Profile page with editable profile picture
- [x] Notifications page for admin messages

### Admin Features
- [x] Dashboard with statistics
- [x] Student management via Excel upload
- [x] Lost items management
- [x] Found items management
- [x] AI-powered match suggestions with confidence scores
- [x] Claims management with verification questions
- [x] Messaging system to students
- [x] Deleted items review and restore
- [x] Admin account management (Super Admin only)
- [x] Password change

### AI Matching
- [x] Uses OpenAI GPT-5.2 via Emergent Integrations
- [x] Returns similarity confidence scores
- [x] Acts as SUGGESTION system only
- [x] Admin makes final decision

---

## What's Been Implemented (January 5, 2025)

### Backend (FastAPI)
- Complete REST API with /api prefix
- MongoDB integration with Motor async driver
- JWT authentication
- Student management with Excel upload
- Item CRUD with soft delete
- Claims system with verification Q&A
- Messaging system
- AI matching endpoint
- File uploads for images
- Audit logging

### Frontend (React)
- Public landing page with college branding
- Student login/dashboard/profile
- Report lost/found item forms
- Admin dashboard with stats
- Admin tables for items/students/claims
- AI matches visualization
- Messaging interface
- Deleted items management
- Settings page
- Mobile-friendly student UI
- Sidebar-based admin UI

### Design
- Outfit font for headings
- Inter font for body
- Slate-900 primary color scheme
- Status badges (Lost: Orange, Found: Green, Claimed: Blue)
- Professional/Corporate theme

---

## P0/P1/P2 Features Remaining

### P0 (Critical)
- None - Core MVP complete

### P1 (Should Have)
- Email notifications when claims are processed
- Bulk student import validation preview
- Student reply functionality for admin messages

### P2 (Nice to Have)
- Image-based AI matching (visual similarity)
- Push notifications
- Analytics dashboard with charts
- Export reports to PDF/Excel

---

## Next Action Items
1. Add sample test students via Excel to fully test student flow
2. Test end-to-end claim process
3. Consider adding email notifications for claim updates
4. Add more detailed audit logging
5. Implement rate limiting for API endpoints

---

## Technical Notes
- EMERGENT_LLM_KEY configured for AI matching
- Super admin auto-created on startup
- Images stored locally in /app/backend/uploads/
- MongoDB collections: students, items, claims, messages, admins, audit_logs

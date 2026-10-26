# CampusLaundry

College Hostel Laundry Quota Tracking, Drop-Off & Cycle Management System.

Built with **Next.js 14 (App Router, TypeScript, Tailwind CSS)** + **Python Flask REST API** + **MySQL 8.0 Cloud Database**.

## Features

### Student Portal
- Live 30-cycle quota tracking with usage progress indicator
- Interactive laundry bag builder with real-time weight estimation (kg)
- Weight tier rules: 1 cycle up to 6.2 kg, 2 cycles for 6.2–8.0 kg, hard cap at 8.0 kg
- Single active wash policy — must complete current wash before submitting new one
- Drop-off history with expected and actual completion dates

### Admin Console (Authenticated)
- **Login system** with bcrypt password hashing and server-side session management
- Active wash cycle monitoring with status stepper (Submitted → In Wash → Ready → Completed)
- Campus-wide metrics: active loads, enrolled students, quota utilization, operational drop points
- Database Tables Manager for CRUD operations on all 7 tables

### Database (RDBMS Showcase)
- **7 Normalized Tables**: `students`, `vendor`, `drop_point`, `laundry_item`, `laundry_transaction`, `transaction_item`, `admin_users`
- **5 Triggers**: Student validation (insert/update), turnaround date calculation, completion timestamps & cancellation refund, admin login timestamp
- **3 Stored Procedures**: `sp_GetStudentPortalData`, `sp_GetHostelDashboardMetrics`, `sp_AuthenticateAdmin`
- **4 Views**: `vw_student_profile`, `vw_student_quota_burn`, `vw_student_active_cycle`, `vw_student_portal_overview`
- **Foreign Key Constraints**: CASCADE and RESTRICT across all related tables
- **Transaction Management**: Atomic multi-statement operations via Python context manager

## Tech Stack
- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Backend**: Python 3, Flask, Flask-CORS, bcrypt, MySQL Connector
- **Database**: MySQL 8.0

## Setup

### Backend
```bash
cd backend
pip install -r requirements.txt
# Set up .env with MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DB
# Run the schema: mysql < schema_mysql.sql
python seed_admin.py   # Create default admin (username: admin, password: admin123)
python app.py
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:3000` and proxies API calls to `http://localhost:5000`.

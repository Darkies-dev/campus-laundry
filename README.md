# CampusLaundry

Smart College Hostel Laundry Quota Tracking, Drop-Off & Cycle Management System.

Built with **Next.js 14 (App Router, TypeScript, Tailwind CSS)** + **Python Flask REST API** + **Aiven MySQL 8.0 Cloud Database**.

## Features
- **Student Portal**:
  - Live 30-cycle quota tracking with 8-month academic pace indicator.
  - Interactive laundry load builder with weight estimation in kg.
  - Weight tier rules: 1 cycle up to 6.2 kg grace allowance, 2 cycles between 6.2 kg and 8.0 kg max cap.
  - Single active wash policy: Prevents submitting a new wash until prior load is returned.
  - Drop-off history with expected and actual completion dates.
- **Hostel Admin & Vendor Console**:
  - Consolidated metrics powered by database stored procedures.
  - Active laundry cycle live stream (filtering out completed/cancelled loads).
  - Database Tables Manager for CRUD operations on students, vendors, drop points, and laundry items.
- **Database Triggers & Stored Procedures**:
  - Strict validations (10-digit student ID, 10-digit contact, B1-B12/G1-G8 hostels, 15/30 quota).
  - Dynamic turnaround date estimation based on day of drop-off.
  - Automatic completion timestamps and cycle refunds upon cancellation.

## Tech Stack
- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Backend**: Python 3, Flask, Flask-CORS, Gunicorn, MySQL Connector
- **Database**: MySQL 8.0 Cloud (Aiven)

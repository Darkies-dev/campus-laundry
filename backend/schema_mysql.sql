-- ==============================================================
-- CampusLaundry Database Schema for MySQL
-- Compatible with MySQL 5.7+ / 8.0+
-- Database: laundry
-- ==============================================================

CREATE DATABASE IF NOT EXISTS laundry;
USE laundry;

-- 1. Students Table
-- Tracks 30-cycle quota over 8-month academic year
CREATE TABLE IF NOT EXISTS students (
    std_id VARCHAR(10) PRIMARY KEY,
    std_name VARCHAR(60) NOT NULL,
    contact BIGINT NOT NULL,
    hostel VARCHAR(50) NOT NULL,
    room VARCHAR(20) NOT NULL,
    academic_year VARCHAR(30) NOT NULL,
    quota INT NOT NULL DEFAULT 30,
    cycle_used INT NOT NULL DEFAULT 0,
    cycle_remaining INT NOT NULL DEFAULT 30
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Vendor Table
CREATE TABLE IF NOT EXISTS vendor (
    Vendor_ID VARCHAR(20) PRIMARY KEY,
    Vendor_Name VARCHAR(50) NOT NULL,
    Contact_No BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Drop_Point (Kiosks) Table
CREATE TABLE IF NOT EXISTS drop_point (
    Drop_Point_ID VARCHAR(20) PRIMARY KEY,
    Location VARCHAR(50) NOT NULL,
    Operational_Status VARCHAR(20) NOT NULL DEFAULT 'Active', -- 'Active', 'Under Maintenance'
    Vendor_ID VARCHAR(20) NOT NULL,
    CONSTRAINT fk_vendor_id FOREIGN KEY (Vendor_ID) REFERENCES vendor(Vendor_ID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Laundry_Item Table (6kg load benchmarks)
CREATE TABLE IF NOT EXISTS laundry_item (
    Item_ID VARCHAR(20) PRIMARY KEY,
    Item_Name VARCHAR(50) NOT NULL,
    Category VARCHAR(30) NOT NULL,
    Standard_Weight DECIMAL(5,2) NOT NULL DEFAULT 0.25
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Laundry_Transaction Table (2-3 day turnaround)
CREATE TABLE IF NOT EXISTS laundry_transaction (
    Transaction_ID VARCHAR(20) PRIMARY KEY,
    std_id VARCHAR(10) NOT NULL,
    Drop_Point_ID VARCHAR(20) NOT NULL,
    Vendor_ID VARCHAR(20) NOT NULL,
    Drop_Off_Date DATE NOT NULL,
    Expected_Completion_Date DATE NOT NULL,
    Total_Weight DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    Cycles_Deducted INT NOT NULL DEFAULT 1,
    Status VARCHAR(20) NOT NULL DEFAULT 'Submitted',
    CONSTRAINT fk_std_id FOREIGN KEY (std_id) REFERENCES students(std_id) ON DELETE CASCADE,
    CONSTRAINT fk_drop_point_id FOREIGN KEY (Drop_Point_ID) REFERENCES drop_point(Drop_Point_ID) ON DELETE RESTRICT,
    CONSTRAINT fk2_vendor_id FOREIGN KEY (Vendor_ID) REFERENCES vendor(Vendor_ID) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Transaction_Item Table
CREATE TABLE IF NOT EXISTS transaction_item (
    Transaction_ID VARCHAR(20) NOT NULL,
    Item_ID VARCHAR(20) NOT NULL,
    Quantity INT NOT NULL DEFAULT 1,
    PRIMARY KEY (Transaction_ID, Item_ID),
    CONSTRAINT fk_transaction_id FOREIGN KEY (Transaction_ID) REFERENCES laundry_transaction(Transaction_ID) ON DELETE CASCADE,
    CONSTRAINT fk_item_id FOREIGN KEY (Item_ID) REFERENCES laundry_item(Item_ID) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========================================================================
-- 7. STUDENT PORTAL OVERVIEW VIEW
-- Aggregates profile, 8-month quota pace, and current active wash status
-- into a single high-performance query for the Student Dashboard
-- ========================================================================
CREATE OR REPLACE VIEW vw_student_portal_overview AS
SELECT 
    s.std_id,
    s.std_name,
    s.contact,
    s.hostel,
    s.room,
    s.academic_year,
    s.quota,
    s.cycle_used,
    s.cycle_remaining,
    ROUND((s.cycle_used / s.quota) * 100, 1) AS burn_percentage,
    act.Transaction_ID AS active_transaction_id,
    act.Status AS active_status,
    act.Total_Weight AS active_total_weight,
    act.Drop_Point_ID AS active_drop_point_id,
    act.drop_point_location AS active_drop_point_location,
    act.Drop_Off_Date AS active_drop_off_date,
    act.Expected_Completion_Date AS active_expected_completion_date
FROM students s
LEFT JOIN (
    SELECT 
        t.std_id,
        t.Transaction_ID,
        t.Status,
        t.Total_Weight,
        t.Drop_Point_ID,
        dp.Location AS drop_point_location,
        t.Drop_Off_Date,
        t.Expected_Completion_Date,
        ROW_NUMBER() OVER (
            PARTITION BY t.std_id 
            ORDER BY t.Drop_Off_Date DESC, t.Transaction_ID DESC
        ) AS rn
    FROM laundry_transaction t
    LEFT JOIN drop_point dp ON t.Drop_Point_ID = dp.Drop_Point_ID
    WHERE t.Status NOT IN ('Completed', 'Cancelled')
) act ON s.std_id = act.std_id AND act.rn = 1;


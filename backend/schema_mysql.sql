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
    Actual_Completion_Date DATE NULL,
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
-- 7. MODULAR VIEWS FOR STUDENT PORTAL (3 DISTINCT VIEWS)
-- ========================================================================

-- View 1: Student Demographics & Academic Profile (Card 1)
CREATE OR REPLACE VIEW vw_student_profile AS
SELECT 
    std_id,
    std_name,
    contact,
    hostel,
    room,
    academic_year
FROM students;

-- View 2: Quota & 8-Month Burn Analytics (Card 2)
CREATE OR REPLACE VIEW vw_student_quota_burn AS
SELECT 
    std_id,
    quota,
    cycle_used,
    cycle_remaining,
    ROUND((cycle_used / quota) * 100, 1) AS burn_percentage,
    CASE 
        WHEN cycle_remaining <= 0 THEN 'Quota Exhausted'
        WHEN cycle_remaining <= 5 THEN 'Critical (Low Quota)'
        WHEN (cycle_used / quota) * 100 > 70 THEN 'Accelerated Burn'
        ELSE 'Optimal Pace'
    END AS pace_status
FROM students;

-- View 3: Live In-Progress Wash Cycle (Card 3)
CREATE OR REPLACE VIEW vw_student_active_cycle AS
SELECT 
    t.std_id,
    t.Transaction_ID,
    t.Status,
    t.Total_Weight,
    t.Drop_Point_ID,
    dp.Location AS drop_point_location,
    t.Drop_Off_Date,
    t.Expected_Completion_Date
FROM (
    SELECT 
        *,
        ROW_NUMBER() OVER (
            PARTITION BY std_id 
            ORDER BY Drop_Off_Date DESC, Transaction_ID DESC
        ) AS rn
    FROM laundry_transaction
    WHERE Status NOT IN ('Completed', 'Cancelled')
) t
LEFT JOIN drop_point dp ON t.Drop_Point_ID = dp.Drop_Point_ID
WHERE t.rn = 1;

-- ========================================================================
-- 8. COMPOSITE STUDENT PORTAL VIEW (JOIN OF THE 3 MODULAR VIEWS)
-- Simply joins the 3 underlying views above, preserving modularity and DRY
-- while enabling a single sub-second query for the web dashboard.
-- ========================================================================
CREATE OR REPLACE VIEW vw_student_portal_overview AS
SELECT 
    p.std_id,
    p.std_name,
    p.contact,
    p.hostel,
    p.room,
    p.academic_year,
    q.quota,
    q.cycle_used,
    q.cycle_remaining,
    q.burn_percentage,
    q.pace_status,
    a.Transaction_ID AS active_transaction_id,
    a.Status AS active_status,
    a.Total_Weight AS active_total_weight,
    a.Drop_Point_ID AS active_drop_point_id,
    a.drop_point_location AS active_drop_point_location,
    a.Drop_Off_Date AS active_drop_off_date,
    a.Expected_Completion_Date AS active_expected_completion_date
FROM vw_student_profile p
JOIN vw_student_quota_burn q ON p.std_id = q.std_id
LEFT JOIN vw_student_active_cycle a ON p.std_id = a.std_id;

-- ========================================================================
-- 9. STORED PROCEDURES
-- ========================================================================

-- Procedure: sp_GetStudentPortalData
-- Executes in a single network round-trip, returning two result sets:
--   1. Top 3 Dashboard Overview Cards (Profile, Quota Burn, and Active Wash from Views)
--   2. Recent 10 Laundry Orders with resolved Drop Point & Vendor information
DELIMITER //

DROP PROCEDURE IF EXISTS sp_GetStudentPortalData //

CREATE PROCEDURE sp_GetStudentPortalData(IN p_std_id VARCHAR(20))
BEGIN
    -- Result Set 1: Student Overview Cards (from vw_student_portal_overview)
    SELECT * 
    FROM vw_student_portal_overview 
    WHERE std_id = p_std_id;

    -- Result Set 2: Recent 10 Laundry Orders with Drop Point & Vendor info
    SELECT 
        t.Transaction_ID,
        t.std_id,
        t.Drop_Point_ID,
        dp.Location AS drop_point_location,
        t.Vendor_ID,
        v.Vendor_Name AS vendor_name,
        t.Drop_Off_Date,
        t.Expected_Completion_Date,
        t.Total_Weight,
        t.Cycles_Deducted,
        t.Status
    FROM laundry_transaction t
    JOIN drop_point dp ON t.Drop_Point_ID = dp.Drop_Point_ID
    JOIN vendor v ON t.Vendor_ID = v.Vendor_ID
    WHERE t.std_id = p_std_id
    ORDER BY t.Drop_Off_Date DESC, t.Transaction_ID DESC
    LIMIT 10;
END //

-- Procedure: sp_GetHostelDashboardMetrics
-- Computes campus-wide executive KPI metrics in a single pass using conditional aggregation,
-- eliminating multiple table scans and avoiding Cartesian product errors.
DROP PROCEDURE IF EXISTS sp_GetHostelDashboardMetrics //

CREATE PROCEDURE sp_GetHostelDashboardMetrics()
BEGIN
    SELECT 
        t.total_transactions,
        t.active_loads,
        t.completed_loads,
        t.avg_load_kg,
        s.total_students,
        s.total_cycles_used,
        s.total_campus_quota,
        dp.active_kiosks
    FROM (
        SELECT 
            COUNT(*) AS total_transactions,
            COUNT(CASE WHEN Status NOT IN ('Completed', 'Cancelled') THEN 1 END) AS active_loads,
            COUNT(CASE WHEN Status = 'Completed' THEN 1 END) AS completed_loads,
            ROUND(AVG(Total_Weight), 2) AS avg_load_kg
        FROM laundry_transaction
    ) t
    CROSS JOIN (
        SELECT 
            COUNT(*) AS total_students,
            COALESCE(SUM(cycle_used), 0) AS total_cycles_used,
            COALESCE(SUM(quota), 0) AS total_campus_quota
        FROM students
    ) s
    CROSS JOIN (
        SELECT 
            COUNT(*) AS active_kiosks
        FROM drop_point
        WHERE Operational_Status = 'Active'
    ) dp;
END //

-- ========================================================================
-- 10. TRIGGERS
-- ========================================================================

-- Trigger 1: Validate Student Insert
DROP TRIGGER IF EXISTS trg_validate_student_insert //

CREATE TRIGGER trg_validate_student_insert
BEFORE INSERT ON students
FOR EACH ROW
BEGIN
    IF LENGTH(NEW.std_id) != 10 OR NEW.std_id NOT REGEXP '^[0-9]{10}$' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Validation Error: wrong student ID';
    END IF;

    IF LENGTH(CAST(NEW.contact AS CHAR)) != 10 OR CAST(NEW.contact AS CHAR) NOT REGEXP '^[6-9][0-9]{9}$' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Validation Error: Phone number must be exactly 10 digits starting with 6, 7, 8, or 9.';
    END IF;

    IF NEW.hostel NOT REGEXP '^(B([1-9]|1[0-2])|G[1-8])$' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Validation Error: Invalid hostel. Allowed hostels are B1 to B12 and G1 to G8 only.';
    END IF;

    IF NEW.quota NOT IN (15, 30) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Validation Error: Quota cycles must be either 15 or 30.';
    END IF;

    IF NEW.cycle_remaining IS NULL THEN
        SET NEW.cycle_remaining = NEW.quota;
    END IF;
    IF NEW.cycle_used IS NULL THEN
        SET NEW.cycle_used = 0;
    END IF;
END //

-- Trigger 2: Validate Student Update
DROP TRIGGER IF EXISTS trg_validate_student_update //

CREATE TRIGGER trg_validate_student_update
BEFORE UPDATE ON students
FOR EACH ROW
BEGIN
    IF LENGTH(NEW.std_id) != 10 OR NEW.std_id NOT REGEXP '^[0-9]{10}$' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Validation Error: wrong student ID';
    END IF;

    IF LENGTH(CAST(NEW.contact AS CHAR)) != 10 OR CAST(NEW.contact AS CHAR) NOT REGEXP '^[6-9][0-9]{9}$' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Validation Error: Phone number must be exactly 10 digits starting with 6, 7, 8, or 9.';
    END IF;

    IF NEW.hostel NOT REGEXP '^(B([1-9]|1[0-2])|G[1-8])$' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Validation Error: Invalid hostel. Allowed hostels are B1 to B12 and G1 to G8 only.';
    END IF;

    IF NEW.quota NOT IN (15, 30) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Validation Error: Quota cycles must be either 15 or 30.';
    END IF;
END //

-- Trigger 3: Set Expected Turnaround Delivery Date
DROP TRIGGER IF EXISTS trg_set_expected_delivery //

CREATE TRIGGER trg_set_expected_delivery
BEFORE INSERT ON laundry_transaction
FOR EACH ROW
BEGIN
    DECLARE v_day_of_week INT;
    IF NEW.Drop_Off_Date IS NULL THEN
        SET NEW.Drop_Off_Date = CURRENT_DATE();
    END IF;
    
    SET v_day_of_week = DAYOFWEEK(NEW.Drop_Off_Date);

    -- 6 = Friday, 7 = Saturday in MySQL DAYOFWEEK (weekend peak load)
    IF v_day_of_week IN (6, 7) THEN
        SET NEW.Expected_Completion_Date = DATE_ADD(NEW.Drop_Off_Date, INTERVAL 5 DAY);
    ELSE
        SET NEW.Expected_Completion_Date = DATE_ADD(NEW.Drop_Off_Date, INTERVAL 3 DAY);
    END IF;
END //

-- Trigger 4: Automatic Completion Timestamp & Cancelled Quota Refund
DROP TRIGGER IF EXISTS trg_before_update_laundry_txn //

CREATE TRIGGER trg_before_update_laundry_txn
BEFORE UPDATE ON laundry_transaction
FOR EACH ROW
BEGIN
    IF NEW.Status IN ('Ready for Pickup', 'Completed') AND OLD.Actual_Completion_Date IS NULL THEN
        SET NEW.Actual_Completion_Date = CURRENT_DATE();
    END IF;

    IF NEW.Status = 'Cancelled' AND OLD.Status != 'Cancelled' THEN
        UPDATE students
        SET cycle_remaining = cycle_remaining + OLD.Cycles_Deducted,
            cycle_used = GREATEST(0, cycle_used - OLD.Cycles_Deducted)
        WHERE std_id = OLD.std_id;
    END IF;
END //

-- ========================================================================
-- 11. ADMIN AUTHENTICATION TABLE
-- ========================================================================

-- 7. Admin Users Table (Authentication & Authorization)
CREATE TABLE IF NOT EXISTS admin_users (
    admin_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(30) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(60) NOT NULL,
    role ENUM('warden', 'vendor', 'superadmin') NOT NULL DEFAULT 'warden',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Trigger 5: Auto-stamp last_login on admin authentication
DROP TRIGGER IF EXISTS trg_admin_login_timestamp //

CREATE TRIGGER trg_admin_login_timestamp
BEFORE UPDATE ON admin_users
FOR EACH ROW
BEGIN
    IF NEW.last_login IS NOT NULL AND (OLD.last_login IS NULL OR NEW.last_login != OLD.last_login) THEN
        SET NEW.last_login = NOW();
    END IF;
END //

-- Procedure: sp_AuthenticateAdmin
-- Verifies admin credentials exist and account is active.
-- Returns admin record for bcrypt password comparison in Python.
DROP PROCEDURE IF EXISTS sp_AuthenticateAdmin //

CREATE PROCEDURE sp_AuthenticateAdmin(IN p_username VARCHAR(30))
BEGIN
    SELECT admin_id, username, password_hash, full_name, role, is_active, last_login
    FROM admin_users
    WHERE username = p_username AND is_active = TRUE;
END //

DELIMITER ;

-- ========================================================================
-- 12. SAMPLE SEED DATA (INITIAL DATA POPULATION)
-- Uses INSERT IGNORE so this script can be executed safely multiple times
-- ========================================================================

-- 1. Vendors
INSERT IGNORE INTO vendor (Vendor_ID, Vendor_Name, Contact_No) VALUES
('VND01', 'Sparkle Wash Services', 9876543210),
('VND02', 'Campus Cleaners Ltd.', 9123456789);

-- 2. Drop Point Kiosks
INSERT IGNORE INTO drop_point (Drop_Point_ID, Location, Operational_Status, Vendor_ID) VALUES
('DP01', 'B1', 'Active', 'VND01'),
('DP02', 'B11', 'Active', 'VND01'),
('DP03', 'G1', 'Active', 'VND02'),
('DP04', 'G5', 'Active', 'VND02');

-- 3. Laundry Clothing Catalog & Standard Unit Weights (Kg)
INSERT IGNORE INTO laundry_item (Item_ID, Item_Name, Category, Standard_Weight) VALUES
('ITM01', 'T-Shirt / Shirt', 'Daily Wear', 0.25),
('ITM02', 'Jeans / Trousers', 'Daily Wear', 0.65),
('ITM03', 'Bed Sheet (Single)', 'Bedding', 0.60),
('ITM04', 'Bed Sheet (Double)', 'Bedding', 1.10),
('ITM05', 'Bath Towel', 'Daily Wear', 0.45),
('ITM06', 'Pillow Cover', 'Bedding', 0.15),
('ITM07', 'Sweater / Hoodie', 'Woolen', 0.80),
('ITM08', 'Blanket / Comforter', 'Bedding', 2.20),
('ITM09', 'Shorts / Lower', 'Daily Wear', 0.30),
('ITM10', 'Lab Coat / Uniform', 'Formals', 0.40);

-- 4. Sample Students (Initialized with 30 / 15 Cycle Quotas)
INSERT IGNORE INTO students (std_id, std_name, contact, hostel, room, academic_year, quota, cycle_used, cycle_remaining) VALUES
('2502050680', 'Aarav Sharma', 9870011223, 'B10', '205', '2nd Year', 30, 9, 21),
('2502050112', 'Priya Patel', 9870022334, 'G8', '108', '2nd Year', 30, 12, 18),
('2602050045', 'Rohan Verma', 9870033445, 'B4', '312', '1st Year', 30, 2, 28),
('2402050088', 'Ananya Iyer', 9870044556, 'G1', '405', '3rd Year', 30, 29, 1),
('2502050650', 'Arush Bhalu', 9666666666, 'G4', '699', '2nd Year', 15, 0, 15);

-- 5. Sample Transactions
INSERT IGNORE INTO laundry_transaction 
(Transaction_ID, std_id, Drop_Point_ID, Vendor_ID, Drop_Off_Date, Expected_Completion_Date, Total_Weight, Cycles_Deducted, Status)
VALUES
('TXN1001', '2502050680', 'DP01', 'VND01', '2026-10-15', '2026-10-18', 5.70, 1, 'Completed'),
('TXN1002', '2502050680', 'DP01', 'VND01', '2026-10-19', '2026-10-22', 6.10, 1, 'Completed'),
('TXN1003', '2502050680', 'DP01', 'VND01', '2026-10-23', '2026-10-28', 5.70, 1, 'In Wash');

-- 6. Sample Line Items for Transactions
INSERT IGNORE INTO transaction_item (Transaction_ID, Item_ID, Quantity) VALUES
('TXN1001', 'ITM01', 8),
('TXN1001', 'ITM02', 3),
('TXN1001', 'ITM05', 2),
('TXN1001', 'ITM09', 3),
('TXN1003', 'ITM01', 8),
('TXN1003', 'ITM02', 3),
('TXN1003', 'ITM05', 2),
('TXN1003', 'ITM09', 3);


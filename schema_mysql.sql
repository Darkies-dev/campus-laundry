-- ==============================================================
-- Laundry Management Database Schema for MySQL
-- Compatible with MySQL 5.7+ / 8.0+
-- ==============================================================

CREATE DATABASE IF NOT EXISTS laundry_db;
USE laundry_db;

-- Drop existing tables in reverse dependency order
DROP TABLE IF EXISTS Transaction_item;
DROP TABLE IF EXISTS Laundry_transaction;
DROP TABLE IF EXISTS Drop_point;
DROP TABLE IF EXISTS Laundry_items;
DROP TABLE IF EXISTS Vendor;
DROP TABLE IF EXISTS Student;

-- 1. Student Table
CREATE TABLE Student (
    Std_id VARCHAR(20) PRIMARY KEY,
    Std_name VARCHAR(100) NOT NULL,
    Academic_year VARCHAR(20) NOT NULL,
    Hostel VARCHAR(50) NOT NULL,
    Room VARCHAR(20) NOT NULL,
    Contact VARCHAR(20) NOT NULL,
    quota INT NOT NULL DEFAULT 30,
    cycle_used INT NOT NULL DEFAULT 0,
    cycle_remaining INT NOT NULL DEFAULT 30,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Vendor Table
CREATE TABLE Vendor (
    vendor_id INT AUTO_INCREMENT PRIMARY KEY,
    vendor_name VARCHAR(100) NOT NULL,
    contact_no VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Drop_point Table
CREATE TABLE Drop_point (
    drop_point_id INT AUTO_INCREMENT PRIMARY KEY,
    location VARCHAR(100) NOT NULL,
    operational_status VARCHAR(30) NOT NULL DEFAULT 'Active', -- 'Active', 'Inactive', 'Under Maintenance'
    vendor_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_droppoint_vendor FOREIGN KEY (vendor_id) REFERENCES Vendor(vendor_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Laundry_items Table
CREATE TABLE Laundry_items (
    item_id INT AUTO_INCREMENT PRIMARY KEY,
    item_name VARCHAR(100) NOT NULL,
    catagory VARCHAR(50) NOT NULL, -- e.g. 'Daily Wear', 'Bedding', 'Woolen', 'Delicate'
    standard_weight DECIMAL(5,2) NOT NULL DEFAULT 0.25, -- in kilograms (kg)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Laundry_transaction Table
CREATE TABLE Laundry_transaction (
    Transaction_ID INT AUTO_INCREMENT PRIMARY KEY,
    Std_id VARCHAR(20) NOT NULL,
    drop_point_id INT NOT NULL,
    vendor_id INT NOT NULL,
    drop_off_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expected_return_date DATE NOT NULL,
    total_weight DECIMAL(6,2) NOT NULL DEFAULT 0.00,
    cycle_deducted INT NOT NULL DEFAULT 1,
    status VARCHAR(30) NOT NULL DEFAULT 'Submitted', -- 'Submitted', 'In Wash', 'Ready for Pickup', 'Completed', 'Cancelled'
    remarks TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_transaction_student FOREIGN KEY (Std_id) REFERENCES Student(Std_id) ON DELETE CASCADE,
    CONSTRAINT fk_transaction_droppoint FOREIGN KEY (drop_point_id) REFERENCES Drop_point(drop_point_id) ON DELETE RESTRICT,
    CONSTRAINT fk_transaction_vendor FOREIGN KEY (vendor_id) REFERENCES Vendor(vendor_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Transaction_item Table (Association Table)
CREATE TABLE Transaction_item (
    Transaction_ID INT NOT NULL,
    item_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    PRIMARY KEY (Transaction_ID, item_id),
    CONSTRAINT fk_ti_transaction FOREIGN KEY (Transaction_ID) REFERENCES Laundry_transaction(Transaction_ID) ON DELETE CASCADE,
    CONSTRAINT fk_ti_item FOREIGN KEY (item_id) REFERENCES Laundry_items(item_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Auth Schema Update for Baguio Pet Boarding
-- This script adds user authentication tables and updates existing tables

-- Users table (if it doesn't exist already)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  address VARCHAR(255),
  role ENUM('admin', 'customer') NOT NULL DEFAULT 'customer',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login TIMESTAMP NULL
);

-- Admin users table for admin-specific details
CREATE TABLE IF NOT EXISTS admin_details (
  admin_id INT PRIMARY KEY,
  department VARCHAR(50),
  access_level INT DEFAULT 1,
  notes TEXT,
  FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Add admin ID column to existing tables for audit trails
ALTER TABLE calendar_availability 
ADD COLUMN IF NOT EXISTS updated_by_admin_id INT,
ADD FOREIGN KEY (updated_by_admin_id) REFERENCES users(id);

-- Add admin ID column to bookings for who processed/updated it
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS processed_by_admin_id INT,
ADD FOREIGN KEY (processed_by_admin_id) REFERENCES users(id);

-- Create an audit log table for important actions
CREATE TABLE IF NOT EXISTS audit_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  action_type VARCHAR(50) NOT NULL,
  action_details TEXT,
  ip_address VARCHAR(45),
  user_agent VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Create a password reset tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Insert default admin user (password: admin123)
-- Note: In production, you should change this password immediately
INSERT IGNORE INTO users (first_name, last_name, email, password, role)
VALUES ('Admin', 'User', 'admin@baguiopetboarding.com', '$2a$10$mC/rkS.QlWHR3YHIOqvPa.TH.Tkdv4YKLNjA5fO7au3ng.OZYIhea', 'admin');

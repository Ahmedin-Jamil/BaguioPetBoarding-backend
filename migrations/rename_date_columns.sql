-- Migration script to rename date columns in bookings table
-- This script handles the migration from check_in_date/check_out_date to start_date/end_date

-- First, create a backup of the bookings table
CREATE TABLE bookings_backup LIKE bookings;
INSERT INTO bookings_backup SELECT * FROM bookings;

-- Add the new columns
ALTER TABLE bookings ADD COLUMN start_date DATE;
ALTER TABLE bookings ADD COLUMN end_date DATE;

-- Copy data from old columns to new columns
UPDATE bookings SET start_date = check_in_date, end_date = check_out_date;

-- Make the new columns NOT NULL where appropriate
ALTER TABLE bookings MODIFY start_date DATE NOT NULL;
ALTER TABLE bookings MODIFY end_date DATE DEFAULT NULL;

-- Drop the old columns
ALTER TABLE bookings DROP COLUMN check_in_date;
ALTER TABLE bookings DROP COLUMN check_out_date;

-- Update any views or triggers that might reference these columns
-- (Add specific view/trigger updates here if needed)

-- Create a migration log entry
CREATE TABLE IF NOT EXISTS migration_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  migration_name VARCHAR(255) NOT NULL,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status ENUM('success', 'failed') DEFAULT 'success',
  notes TEXT
);

INSERT INTO migration_log (migration_name, notes) 
VALUES ('rename_date_columns', 'Renamed check_in_date to start_date and check_out_date to end_date');


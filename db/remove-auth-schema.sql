-- Remove foreign key constraints for user authentication
ALTER TABLE bookings DROP FOREIGN KEY bookings_ibfk_1; -- user_id reference
ALTER TABLE bookings DROP FOREIGN KEY bookings_ibfk_2; -- pet_id reference
ALTER TABLE bookings DROP FOREIGN KEY bookings_ibfk_4; -- confirmed_by reference
ALTER TABLE bookings DROP FOREIGN KEY bookings_ibfk_5; -- cancelled_by reference

-- Modify bookings table to support guest bookings
ALTER TABLE bookings 
  DROP COLUMN user_id,
  DROP COLUMN pet_id,
  DROP COLUMN confirmed_by,
  DROP COLUMN cancelled_by,
  ADD COLUMN owner_name VARCHAR(255) NOT NULL,
  ADD COLUMN owner_email VARCHAR(255) NOT NULL,
  ADD COLUMN owner_phone VARCHAR(50) NOT NULL,
  ADD COLUMN pet_name VARCHAR(255) NOT NULL,
  ADD COLUMN pet_type ENUM('Dog', 'Cat', 'Other') NOT NULL,
  ADD COLUMN pet_breed VARCHAR(100),
  ADD COLUMN pet_age VARCHAR(20),
  ADD COLUMN reference_number VARCHAR(50),
  ADD COLUMN booking_notes TEXT,
  MODIFY COLUMN status ENUM('pending', 'confirmed', 'completed', 'cancelled') DEFAULT 'pending';

-- Update existing indexes
ALTER TABLE bookings 
  ADD INDEX idx_owner_email (owner_email),
  ADD INDEX idx_reference_number (reference_number);

-- Create a simplified service types table if it doesn't exist
CREATE TABLE IF NOT EXISTS simplified_services (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  type ENUM('overnight', 'daycare', 'grooming') NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  max_slots INT NOT NULL DEFAULT 10,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

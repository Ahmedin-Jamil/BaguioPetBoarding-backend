-- Add guest columns to bookings table
ALTER TABLE bookings
  ADD COLUMN guest_email VARCHAR(100) AFTER reference_number,
  ADD COLUMN guest_phone VARCHAR(20) AFTER guest_email,
  ADD COLUMN guest_address TEXT AFTER guest_phone,
  ADD COLUMN guest_first_name VARCHAR(100) AFTER guest_address,
  ADD COLUMN guest_last_name VARCHAR(100) AFTER guest_first_name,
  ADD COLUMN guest_pet_name VARCHAR(100) AFTER guest_last_name,
  ADD COLUMN guest_pet_breed VARCHAR(100) AFTER guest_pet_name,
  ADD COLUMN guest_pet_gender VARCHAR(20) AFTER guest_pet_breed,
  ADD COLUMN guest_pet_dob DATE AFTER guest_pet_gender,
  ADD COLUMN guest_pet_weight DECIMAL(5, 2) AFTER guest_pet_dob;

-- Make pet_id nullable for guest bookings
ALTER TABLE bookings MODIFY COLUMN pet_id INT NULL;

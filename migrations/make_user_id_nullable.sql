-- Make user_id nullable in bookings table
ALTER TABLE bookings MODIFY COLUMN user_id INT NULL;

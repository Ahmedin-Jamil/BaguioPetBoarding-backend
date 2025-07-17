-- Remove night_fee from services table
ALTER TABLE services DROP COLUMN night_fee;

-- Remove night_fee from bookings table
ALTER TABLE bookings DROP COLUMN night_fee;

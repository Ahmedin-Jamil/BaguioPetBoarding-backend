-- Migration to add reference_number column to bookings table

-- Add reference_number column
ALTER TABLE bookings ADD COLUMN reference_number VARCHAR(20) UNIQUE;

-- Update existing bookings with reference numbers
UPDATE bookings SET reference_number = 'BPB' || LPAD(booking_id::text, 4, '0');

-- Create trigger to auto-generate reference numbers for new bookings
CREATE OR REPLACE FUNCTION generate_booking_reference()
RETURNS TRIGGER AS $$
BEGIN
    NEW.reference_number := 'BPB' || LPAD(currval(pg_get_serial_sequence('bookings', 'booking_id'))::text, 4, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER before_booking_insert
    BEFORE INSERT ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION generate_booking_reference();

-- Create migration log entry
INSERT INTO migration_log (migration_name, notes) 
VALUES ('add_reference_number', 'Added reference_number column and auto-generation trigger to bookings table');

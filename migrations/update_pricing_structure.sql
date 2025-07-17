-- Migration to update the services table with new pricing structure based on pet weight
-- and update the bookings table to include weight_category and night_fee fields

-- First, create a backup of the services table
CREATE TABLE IF NOT EXISTS services_backup AS SELECT * FROM services;

-- Modify the services table to add new pricing columns
ALTER TABLE services 
  ADD COLUMN price_small DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN price_medium DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN price_large DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN price_xlarge DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN price_cat DECIMAL(10, 2) DEFAULT NULL,
  ADD COLUMN weight_small VARCHAR(20) DEFAULT '1-9 KG',
  ADD COLUMN weight_medium VARCHAR(20) DEFAULT '9-25 KG',
  ADD COLUMN weight_large VARCHAR(20) DEFAULT '25-40 KG',
  ADD COLUMN weight_xlarge VARCHAR(20) DEFAULT '40+ KG';

-- Update the services with the new pricing structure
-- Copy the old price to all weight categories as a starting point
UPDATE services SET 
  price_small = price,
  price_medium = price,
  price_large = price,
  price_xlarge = price;

-- Update Deluxe Room pricing
UPDATE services SET 
  price_small = 500.00,
  price_medium = 650.00,
  price_large = 750.00,
  price_xlarge = 1000.00
WHERE service_name = 'Deluxe Room' AND service_type = 'overnight';

-- Update Premium Room pricing
UPDATE services SET 
  price_small = 650.00,
  price_medium = 800.00,
  price_large = 1000.00,
  price_xlarge = 1500.00
WHERE service_name = 'Premium Room' AND service_type = 'overnight';

-- Update Executive Room pricing
UPDATE services SET 
  price_small = 650.00,
  price_medium = 850.00,
  price_large = 1000.00,
  price_xlarge = 1500.00
WHERE service_name = 'Executive Room' AND service_type = 'overnight';

-- Update Pet Daycare pricing
UPDATE services SET 
  price_small = 350.00,
  price_medium = 450.00,
  price_large = 500.00,
  price_xlarge = 600.00
WHERE service_name = 'Pet Daycare' AND service_type = 'daycare';

-- Update Premium Grooming pricing
UPDATE services SET 
  price_small = 750.00,
  price_medium = 850.00,
  price_large = 1000.00,
  price_xlarge = 1500.00,
  price_cat = 950.00
WHERE service_name = 'Premium Grooming' AND service_type = 'grooming';

-- Update Basic Bath & Dry pricing
UPDATE services SET 
  price_small = 350.00,
  price_medium = 450.00,
  price_large = 550.00,
  price_xlarge = 750.00,
  price_cat = 500.00
WHERE service_name = 'Basic Bath & Dry' AND service_type = 'grooming';

-- Update Special Grooming Package pricing (previously Special Grooming Package)
UPDATE services SET 
  service_name = 'Special Care Package',
  price_small = 550.00,
  price_medium = 650.00,
  price_large = 800.00,
  price_xlarge = 1000.00,
  price_cat = 700.00
WHERE service_name = 'Special Grooming Package' AND service_type = 'grooming';

-- Create a backup of the bookings table
CREATE TABLE IF NOT EXISTS bookings_backup AS SELECT * FROM bookings;

-- Modify the bookings table to add weight_category field
ALTER TABLE bookings
  ADD COLUMN weight_category ENUM('Small', 'Medium', 'Large', 'X-Large', 'Cat') NOT NULL DEFAULT 'Small';

-- Modify room_type ENUM to use the correct values
ALTER TABLE bookings 
  MODIFY COLUMN room_type ENUM('Deluxe Room', 'Premium Room', 'Executive Room') NOT NULL;

-- No need to update existing bookings as we're keeping Executive Room as is

-- Set default weight categories for existing bookings based on pet weight
UPDATE bookings b
JOIN pets p ON b.pet_id = p.pet_id
SET 
  b.weight_category = CASE 
    WHEN p.pet_type = 'Cat' THEN 'Cat'
    WHEN p.weight IS NULL OR p.weight <= 9 THEN 'Small'
    WHEN p.weight <= 25 THEN 'Medium'
    WHEN p.weight <= 40 THEN 'Large'
    ELSE 'X-Large'
  END;

-- No night fee needed

-- Remove the old price column from services table
ALTER TABLE services DROP COLUMN price;

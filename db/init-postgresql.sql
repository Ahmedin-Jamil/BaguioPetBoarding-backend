-- Initialize PostgreSQL database schema for Baguio Pet Boarding

BEGIN;

-- Drop existing tables if they exist
DROP TABLE IF EXISTS calendar_availability CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS pets CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS services CASCADE;
DROP TABLE IF EXISTS service_categories CASCADE;

-- Create custom types for ENUMs
DO $$ 
DECLARE
BEGIN
    -- Create pet_type ENUM
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pet_type') THEN
        CREATE TYPE pet_type AS ENUM ('Dog', 'Cat');
    END IF;

    -- Create service_type ENUM
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'service_type') THEN
        CREATE TYPE service_type AS ENUM ('overnight', 'daycare', 'grooming');
    END IF;

    -- Create room_type ENUM
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'room_type') THEN
        CREATE TYPE room_type AS ENUM ('Deluxe Room', 'Premium Room', 'Executive Room');
    END IF;

    -- Create weight_category ENUM
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'weight_category') THEN
        CREATE TYPE weight_category AS ENUM ('Small', 'Medium', 'Large', 'X-Large', 'Cat');
    END IF;

    -- Create gender_type ENUM
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gender_type') THEN
        CREATE TYPE gender_type AS ENUM ('Male', 'Female');
    END IF;

    -- Create booking_status ENUM
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_status') THEN
        CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'completed', 'cancelled', 'no-show');
    END IF;
END
$$;

-- Create service_categories table
CREATE TABLE IF NOT EXISTS service_categories (
    category_id SERIAL PRIMARY KEY,
    category_name VARCHAR(50) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_service_categories_timestamp
    BEFORE UPDATE ON service_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

-- Create services table
CREATE TABLE IF NOT EXISTS services (
    service_id SERIAL PRIMARY KEY,
    category_id INTEGER NOT NULL,
    service_name VARCHAR(100) NOT NULL,
    service_type service_type NOT NULL,
    description TEXT,
    price_small DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    price_medium DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    price_large DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    price_xlarge DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    price_cat DECIMAL(10, 2),
    max_slots INTEGER NOT NULL DEFAULT 0,
    duration_hours DECIMAL(4, 2),
    weight_small VARCHAR(20) DEFAULT '1-9 KG',
    weight_medium VARCHAR(20) DEFAULT '9-25 KG',
    weight_large VARCHAR(20) DEFAULT '25-40 KG',
    weight_xlarge VARCHAR(20) DEFAULT '40+ KG',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES service_categories(category_id)
);

CREATE TRIGGER update_services_timestamp
    BEFORE UPDATE ON services
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    phone VARCHAR(20) NOT NULL,
    address TEXT,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_users_timestamp
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

-- Create pets table
CREATE TABLE IF NOT EXISTS pets (
    pet_id SERIAL PRIMARY KEY,
    user_id INTEGER,
    pet_name VARCHAR(100) NOT NULL,
    pet_type pet_type NOT NULL,
    breed VARCHAR(100),
    age VARCHAR(20),
    weight DECIMAL(5, 2),
    gender gender_type,
    special_instructions TEXT,
    medical_conditions TEXT,
    emergency_contact VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TRIGGER update_pets_timestamp
    BEFORE UPDATE ON pets
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

-- Create bookings table
CREATE TABLE IF NOT EXISTS bookings (
    booking_id SERIAL PRIMARY KEY,
    reference_number VARCHAR(50) UNIQUE,
    user_id INTEGER NOT NULL REFERENCES users(user_id),
    pet_id INTEGER NOT NULL REFERENCES pets(pet_id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status booking_status DEFAULT 'pending',
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    special_requests TEXT,
    admin_notes TEXT,
    confirmed_by INTEGER REFERENCES users(user_id),
    confirmed_at TIMESTAMP,
    cancelled_by INTEGER REFERENCES users(user_id),
    cancelled_at TIMESTAMP,
    cancellation_reason TEXT,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create booking_services junction table
CREATE TABLE IF NOT EXISTS booking_services (
    booking_id INTEGER NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(service_id),
    price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (booking_id, service_id)
);

CREATE TRIGGER update_booking_services_timestamp
    BEFORE UPDATE ON booking_services
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_bookings_timestamp
    BEFORE UPDATE ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

-- Create calendar_availability table
CREATE TABLE IF NOT EXISTS calendar_availability (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    is_available BOOLEAN DEFAULT TRUE,
    reason VARCHAR(255),
    notes TEXT,
    updated_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (updated_by) REFERENCES users(user_id)
);

CREATE TRIGGER update_calendar_availability_timestamp
    BEFORE UPDATE ON calendar_availability
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

-- Seed data for service categories
INSERT INTO service_categories (category_name, description) VALUES
('Overnight Boarding', 'Overnight pet boarding services for dogs and cats'),
('Day Care', 'Daytime care services for pets'),
('Grooming', 'Pet grooming services')
ON CONFLICT DO NOTHING;

-- Seed data for services
INSERT INTO services (category_id, service_name, service_type, description, price_small, price_medium, price_large, price_xlarge, price_cat, max_slots, duration_hours) VALUES
(1, 'Deluxe Room', 'overnight', 'Regular Room Gated with 24/7 Pet Sitter. Well Ventilated. (1) HOUR Access in Play Area Daily. Morning and Evening Outdoor Breaks. Inclusive of Regular Bed and Food Bowls + Treats.', 500.00, 650.00, 750.00, 1000.00, NULL, 10, 24.00),
(1, 'Premium Room', 'overnight', 'Premium Gated Room with 24/7 Pet Sitter. Well Ventilated. (2) HOURS Access in our Play Area Daily. Morning and Evening Outdoor Breaks. Inclusive of Premium Bed and Ceramic Bowls + Treats.', 650.00, 800.00, 1000.00, 1500.00, NULL, 10, 24.00),
(1, 'Executive Room', 'overnight', 'Premium Full Room with 24/7 Pet Sitter. Good for SOLO or Groups. Well Ventilated with AIR PURIFIER. (3) HOURS Access in our Play Area Daily. Morning and Evening Outdoor Breaks. Inclusive of Premium Bed and Ceramic Bowls + Treats.', 650.00, 850.00, 1000.00, 1500.00, NULL, 2, 24.00),
(2, 'Pet Daycare', 'daycare', 'Our day care services provide your pet with supervised play, socialization, and exercise in a safe, fun environment. Minimum of (8) Hours.', 350.00, 450.00, 500.00, 600.00, NULL, 10, 8.00),
(3, 'Premium Grooming', 'grooming', 'Complete grooming package including bath, haircut, styling, ear cleaning, teeth brushing. Considered as our most popular service. St.Roche Premium Products.', 750.00, 850.00, 1000.00, 1500.00, 950.00, 5, 2.00),
(3, 'Basic Bath & Dry', 'grooming', 'A thorough cleansing bath with organic shampoo and conditioner. Perfect for pets who need a quick refresh. Blowdry, Perfume & Powder (Optional)', 350.00, 450.00, 550.00, 750.00, 500.00, 10, 1.00),
(3, 'Special Care Package', 'grooming', 'Luxury treatment for pets with special needs. Basic bath and dry, paw pad treatment.', 550.00, 650.00, 800.00, 1000.00, 700.00, 5, 2.50)
ON CONFLICT DO NOTHING;

COMMIT;


-- Pet Hotel Database Schema for PostgreSQL

-- Drop existing types if they exist
DROP TYPE IF EXISTS service_type CASCADE;
DROP TYPE IF EXISTS pet_type CASCADE;
DROP TYPE IF EXISTS gender_type CASCADE;
DROP TYPE IF EXISTS room_type CASCADE;
DROP TYPE IF EXISTS booking_status CASCADE;
DROP TYPE IF EXISTS weight_category CASCADE;

-- Create custom ENUM types
CREATE TYPE service_type AS ENUM ('overnight', 'daycare', 'grooming');
CREATE TYPE pet_type AS ENUM ('Dog', 'Cat');
CREATE TYPE gender_type AS ENUM ('Male', 'Female');
CREATE TYPE room_type AS ENUM ('Deluxe Room', 'Premium Room', 'Executive Room');
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'completed', 'cancelled', 'no-show');
CREATE TYPE weight_category AS ENUM ('Small', 'Medium', 'Large', 'X-Large', 'Cat');

-- Drop existing tables if they exist
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS pets CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS calendar_availability CASCADE;
DROP TABLE IF EXISTS services CASCADE;
DROP TABLE IF EXISTS service_categories CASCADE;

-- Create service_categories table
CREATE TABLE service_categories (
    category_id SERIAL PRIMARY KEY,
    category_name VARCHAR(50) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create services table
CREATE TABLE services (
    service_id SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES service_categories(category_id),
    service_name VARCHAR(100) NOT NULL,
    service_type service_type NOT NULL,
    description TEXT,
    price_small DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    price_medium DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    price_large DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    price_xlarge DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    price_cat_small DECIMAL(10, 2),
    price_cat_medium DECIMAL(10, 2),
    max_slots INTEGER NOT NULL DEFAULT 0,
    duration_hours DECIMAL(4, 2),
    weight_small VARCHAR(20) DEFAULT '1-9 KG',
    weight_medium VARCHAR(20) DEFAULT '9-25 KG',
    weight_large VARCHAR(20) DEFAULT '25-40 KG',
    weight_xlarge VARCHAR(20) DEFAULT '40+ KG',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create users table
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    phone VARCHAR(20) NOT NULL,
    address TEXT,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create pets table
CREATE TABLE pets (
    pet_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id),
    pet_name VARCHAR(100) NOT NULL,
    pet_type pet_type NOT NULL,
    breed VARCHAR(100),
    age VARCHAR(20),
    weight DECIMAL(5, 2),
    gender gender_type,
    special_instructions TEXT,
    medical_conditions TEXT,
    emergency_contact VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create bookings table
CREATE TABLE bookings (
    booking_id SERIAL PRIMARY KEY,
    reference_number VARCHAR(50) UNIQUE,
    
    -- Owner info (no user account required)
    owner_first_name VARCHAR(100) NOT NULL,
    owner_last_name VARCHAR(100) NOT NULL,
    owner_email VARCHAR(100) NOT NULL,
    owner_phone VARCHAR(20) NOT NULL,
    owner_address TEXT,

    -- Pet info
    pet_name VARCHAR(100) NOT NULL,
    pet_type pet_type NOT NULL,
    breed VARCHAR(100),
    gender gender_type,
    date_of_birth DATE,
    weight_category weight_category NOT NULL,

    -- Service / booking details
    service_id INTEGER NOT NULL REFERENCES services(service_id),
    room_type room_type NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    start_time TIME,
    end_time TIME,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    special_requests TEXT,
    grooming_type VARCHAR(255),

    status booking_status DEFAULT 'pending',
    confirmed_by INTEGER REFERENCES users(user_id),
    confirmed_at TIMESTAMP WITH TIME ZONE,
    cancelled_by INTEGER REFERENCES users(user_id),
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancellation_reason TEXT,
    completed_at TIMESTAMP WITH TIME ZONE,
    admin_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create calendar_availability table
CREATE TABLE calendar_availability (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    is_available BOOLEAN DEFAULT TRUE,
    reason VARCHAR(255),
    notes TEXT,
    updated_by INTEGER REFERENCES users(user_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date)
);

-- Create trigger function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for all tables
CREATE TRIGGER update_service_categories_updated_at
    BEFORE UPDATE ON service_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_services_updated_at
    BEFORE UPDATE ON services
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pets_updated_at
    BEFORE UPDATE ON pets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_calendar_availability_updated_at
    BEFORE UPDATE ON calendar_availability
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at
    BEFORE UPDATE ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Seed data for service categories
INSERT INTO service_categories (category_name, description) VALUES
('Overnight Boarding', 'Overnight pet boarding services for dogs and cats'),
('Day Care', 'Daytime care services for pets'),
('Grooming', 'Pet grooming services');

-- Seed data for services
INSERT INTO services (category_id, service_name, service_type, description, price_small, price_medium, price_large, price_xlarge, price_cat_small, price_cat_medium, max_slots, duration_hours) VALUES
(1, 'Deluxe Room', 'overnight', 'Regular Room Gated with 24/7 Pet Sitter. Well Ventilated. (1) HOUR Access in Play Area Daily. Morning and Evening Outdoor Breaks. Inclusive of Regular Bed and Food Bowls + Treats.', 500.00, 650.00, 750.00, 1000.00, NULL, NULL, 10, 24.00),
(1, 'Premium Room', 'overnight', 'Premium Gated Room with 24/7 Pet Sitter. Well Ventilated. (2) HOURS Access in our Play Area Daily. Morning and Evening Outdoor Breaks. Inclusive of Premium Bed and Ceramic Bowls + Treats.', 650.00, 800.00, 1000.00, 1500.00, NULL, NULL, 10, 24.00),
(1, 'Executive Room', 'overnight', 'Premium Full Room with 24/7 Pet Sitter. Good for SOLO or Groups. Well Ventilated with AIR PURIFIER. (3) HOURS Access in our Play Area Daily. Morning and Evening Outdoor Breaks. Inclusive of Premium Bed and Ceramic Bowls + Treats.', 650.00, 850.00, 1000.00, 1500.00, NULL, NULL, 2, 24.00),
(2, 'Pet Daycare', 'daycare', 'Our day care services provide your pet with supervised play, socialization, and exercise in a safe, fun environment. Minimum of (8) Hours.', 350.00, 450.00, 500.00, 600.00, NULL, NULL, 10, 8.00),
(3, 'Premium Grooming', 'grooming', 'Complete grooming package including bath, haircut, styling, ear cleaning, teeth brushing. Considered as our most popular service. St.Roche Premium Products.', 750.00, 850.00, 1000.00, 1500.00, 950.00, 1100.00, 5, 2.00),
(3, 'Basic Bath & Dry', 'grooming', 'A thorough cleansing bath with organic shampoo and conditioner. Perfect for pets who need a quick refresh. Blowdry, Perfume & Powder (Optional)', 350.00, 450.00, 550.00, 750.00, 500.00, 650.00, 10, 1.00),
(3, 'Special Care Package', 'grooming', 'Luxury treatment for pets with special needs. Basic bath and dry, paw pad treatment.', 550.00, 650.00, 800.00, 1000.00, 700.00, 850.00, 5, 2.50);

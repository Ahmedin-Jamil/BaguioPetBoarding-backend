-- Create pet_hotel database if it doesn't exist
CREATE DATABASE IF NOT EXISTS pet_hotel;
USE pet_hotel;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS pets;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS calendar_availability;
DROP TABLE IF EXISTS services;
DROP TABLE IF EXISTS service_categories;
SET FOREIGN_KEY_CHECKS = 1;

-- Create service_categories table first (no dependencies)
CREATE TABLE IF NOT EXISTS service_categories (
  category_id INT AUTO_INCREMENT PRIMARY KEY,
  category_name VARCHAR(50) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create services table (depends on service_categories)
CREATE TABLE IF NOT EXISTS services (
  service_id INT AUTO_INCREMENT PRIMARY KEY,
  category_id INT NOT NULL,
  service_name VARCHAR(100) NOT NULL,
  service_type ENUM('overnight', 'daycare', 'grooming') NOT NULL,
  description TEXT,
  price_small DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  price_medium DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  price_large DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  price_xlarge DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  price_cat DECIMAL(10, 2) DEFAULT NULL,

  max_slots INT NOT NULL DEFAULT 0,
  duration_hours DECIMAL(4, 2),
  weight_small VARCHAR(20) DEFAULT '1-9 KG',
  weight_medium VARCHAR(20) DEFAULT '9-25 KG',
  weight_large VARCHAR(20) DEFAULT '25-40 KG',
  weight_xlarge VARCHAR(20) DEFAULT '40+ KG',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES service_categories(category_id)
);

-- Create users table (no dependencies)
CREATE TABLE IF NOT EXISTS users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  phone VARCHAR(20) NOT NULL,
  address TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create pets table (depends on users)
CREATE TABLE IF NOT EXISTS pets (
  pet_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  pet_name VARCHAR(100) NOT NULL,
  pet_type ENUM('Dog', 'Cat') NOT NULL,
  breed VARCHAR(100),
  age VARCHAR(20),
  weight DECIMAL(5, 2),
  gender ENUM('Male', 'Female'),
  special_instructions TEXT,
  medical_conditions TEXT,
  emergency_contact VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Create bookings table (depends on users, pets, services)
CREATE TABLE IF NOT EXISTS bookings (
  booking_id INT AUTO_INCREMENT PRIMARY KEY,
  reference_number VARCHAR(50) UNIQUE,

  -- Owner info (no user account required)
  owner_first_name VARCHAR(100) NOT NULL,
  owner_last_name  VARCHAR(100) NOT NULL,
  owner_email      VARCHAR(100) NOT NULL,
  owner_phone      VARCHAR(20)  NOT NULL,
  owner_address    TEXT,

  -- Pet info
  pet_name       VARCHAR(100) NOT NULL,
  pet_type       ENUM('Dog','Cat') NOT NULL,
  breed          VARCHAR(100),
  gender         ENUM('Male','Female'),
  date_of_birth  DATE,
  weight_category ENUM('Small','Medium','Large','X-Large','Cat') NOT NULL,

  -- Service / booking details
  service_id  INT NOT NULL,
  room_type   ENUM('Deluxe Room','Premium Room','Executive Room') NOT NULL,
  start_date  DATE NOT NULL,
  end_date    DATE DEFAULT NULL,
  start_time  TIME,
  end_time    TIME,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  special_requests TEXT,
  grooming_type VARCHAR(255) NULL,

  status ENUM('pending','confirmed','completed','cancelled','no-show') DEFAULT 'pending',
  confirmed_by INT,
  confirmed_at TIMESTAMP NULL,
  cancelled_by INT,
  cancelled_at TIMESTAMP NULL,
  cancellation_reason TEXT,
  completed_at TIMESTAMP NULL,
  admin_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (service_id) REFERENCES services(service_id),
  FOREIGN KEY (confirmed_by) REFERENCES users(user_id),
  FOREIGN KEY (cancelled_by) REFERENCES users(user_id)
);

-- Create calendar_availability table (depends on users)
CREATE TABLE IF NOT EXISTS calendar_availability (
  id INT AUTO_INCREMENT PRIMARY KEY,
  date DATE NOT NULL,
  is_available BOOLEAN DEFAULT TRUE,
  reason VARCHAR(255),
  notes TEXT,
  updated_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE(date),
  FOREIGN KEY (updated_by) REFERENCES users(user_id)
);

-- Seed data for service categories
INSERT INTO service_categories (category_name, description) VALUES
('Overnight Boarding', 'Overnight pet boarding services for dogs and cats'),
('Day Care', 'Daytime care services for pets'),
('Grooming', 'Pet grooming services');

-- Seed data for services
INSERT INTO services (category_id, service_name, service_type, description, price_small, price_medium, price_large, price_xlarge, price_cat, max_slots, duration_hours) VALUES
(1, 'Deluxe Room', 'overnight', 'Regular Room Gated with 24/7 Pet Sitter. Well Ventilated. (1) HOUR Access in Play Area Daily. Morning and Evening Outdoor Breaks. Inclusive of Regular Bed and Food Bowls + Treats.', 500.00, 650.00, 750.00, 1000.00, NULL, 10, 24.00),
(1, 'Premium Room', 'overnight', 'Premium Gated Room with 24/7 Pet Sitter. Well Ventilated. (2) HOURS Access in our Play Area Daily. Morning and Evening Outdoor Breaks. Inclusive of Premium Bed and Ceramic Bowls + Treats.', 650.00, 800.00, 1000.00, 1500.00, NULL, 10, 24.00),
(1, 'Executive Room', 'overnight', 'Premium Full Room with 24/7 Pet Sitter. Good for SOLO or Groups. Well Ventilated with AIR PURIFIER. (3) HOURS Access in our Play Area Daily. Morning and Evening Outdoor Breaks. Inclusive of Premium Bed and Ceramic Bowls + Treats.', 650.00, 850.00, 1000.00, 1500.00, NULL, 2, 24.00),
(2, 'Pet Daycare', 'daycare', 'Our day care services provide your pet with supervised play, socialization, and exercise in a safe, fun environment. Minimum of (8) Hours.', 350.00, 450.00, 500.00, 600.00, NULL, NULL, 10, 8.00),
(3, 'Premium Grooming', 'grooming', 'Complete grooming package including bath, haircut, styling, ear cleaning, teeth brushing. Considered as our most popular service. St.Roche Premium Products.', 750.00, 850.00, 1000.00, 1500.00, 950.00, NULL, 5, 2.00),
(3, 'Basic Bath & Dry', 'grooming', 'A thorough cleansing bath with organic shampoo and conditioner. Perfect for pets who need a quick refresh. Blowdry, Perfume & Powder (Optional)', 350.00, 450.00, 550.00, 750.00, 500.00, NULL, 10, 1.00),
(3, 'Special Care Package', 'grooming', 'Luxury treatment for pets with special needs. Basic bath and dry, paw pad treatment.', 550.00, 650.00, 800.00, 1000.00, 700.00, NULL, 5, 2.50)

-- Create the pets table if it doesn't exist
CREATE TABLE IF NOT EXISTS pets (
  pet_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  pet_name VARCHAR(100) NOT NULL,
  pet_type ENUM('Dog', 'Cat') NOT NULL,
  breed VARCHAR(100),
  gender VARCHAR(20),
  date_of_birth DATE,
  weight DECIMAL(5,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

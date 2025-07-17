-- Password Reset Token Table
CREATE TABLE IF NOT EXISTS `password_reset_tokens` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `token` VARCHAR(255) NOT NULL,
  `expires_at` DATETIME NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `ip_address` VARCHAR(45) NULL, -- Store IP address for security auditing (IPv6 compatible length)
  `user_agent` VARCHAR(255) NULL, -- Store user-agent for security tracking
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Add index for token for faster token lookups
CREATE INDEX `idx_password_reset_tokens_token` ON `password_reset_tokens` (`token`);

-- Add index for expires_at to speed up cleanup of expired tokens
CREATE INDEX `idx_password_reset_tokens_expires_at` ON `password_reset_tokens` (`expires_at`);

-- Audit Log Table (if not exists)
CREATE TABLE IF NOT EXISTS `audit_log` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `user_id` INT NULL,
  `action` VARCHAR(50) NOT NULL,
  `description` VARCHAR(255) NULL,
  `ip_address` VARCHAR(45) NULL, -- Store IP address for security auditing (IPv6 compatible)
  `user_agent` VARCHAR(255) NULL, -- Store browser/client information
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `status` VARCHAR(20) DEFAULT 'success', -- Track if action succeeded or failed
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Add index on action column for faster audit log queries
CREATE INDEX `idx_audit_log_action` ON `audit_log` (`action`);

-- Add index on user_id for faster user activity tracking
CREATE INDEX `idx_audit_log_user_id` ON `audit_log` (`user_id`);

-- Add index on created_at for date range queries
CREATE INDEX `idx_audit_log_created_at` ON `audit_log` (`created_at`);

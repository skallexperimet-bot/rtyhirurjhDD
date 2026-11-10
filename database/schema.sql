-- Volt & Valve Service Provider Booking Platform
-- MySQL Database Schema (Compatible with InfinityFree MySQL 5.7 / 8.0 / MariaDB)
-- Charset: utf8mb4

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+05:30";

-- 1. Users Table
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `full_name` VARCHAR(120) NOT NULL,
  `mobile_number` VARCHAR(15) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `address` TEXT NOT NULL,
  `village_city` VARCHAR(100) NOT NULL,
  `district` VARCHAR(100) NOT NULL,
  `state` VARCHAR(100) NOT NULL,
  `pin_code` VARCHAR(10) NOT NULL,
  `is_otp_verified` TINYINT(1) NOT NULL DEFAULT 0,
  `status` ENUM('active', 'blocked') NOT NULL DEFAULT 'active',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_user_mobile` (`mobile_number`),
  KEY `idx_user_pin` (`pin_code`),
  KEY `idx_user_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Electricians Table
CREATE TABLE IF NOT EXISTS `electricians` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `full_name` VARCHAR(120) NOT NULL,
  `mobile_number` VARCHAR(15) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `address` TEXT NOT NULL,
  `pin_code` VARCHAR(10) NOT NULL,
  `qualification_details` TEXT NOT NULL,
  `experience_details` TEXT NOT NULL,
  `is_otp_verified` TINYINT(1) NOT NULL DEFAULT 0,
  `approval_status` ENUM('pending', 'approved', 'rejected', 'blocked') NOT NULL DEFAULT 'pending',
  `rejection_reason` TEXT NULL,
  `average_rating` DECIMAL(3,2) NOT NULL DEFAULT 0.00,
  `total_reviews` INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_elec_mobile` (`mobile_number`),
  KEY `idx_elec_approval` (`approval_status`),
  KEY `idx_elec_pin` (`pin_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Plumbers Table
CREATE TABLE IF NOT EXISTS `plumbers` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `full_name` VARCHAR(120) NOT NULL,
  `mobile_number` VARCHAR(15) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `address` TEXT NOT NULL,
  `pin_code` VARCHAR(10) NOT NULL,
  `qualification_details` TEXT NOT NULL,
  `experience_details` TEXT NOT NULL,
  `is_otp_verified` TINYINT(1) NOT NULL DEFAULT 0,
  `approval_status` ENUM('pending', 'approved', 'rejected', 'blocked') NOT NULL DEFAULT 'pending',
  `rejection_reason` TEXT NULL,
  `average_rating` DECIMAL(3,2) NOT NULL DEFAULT 0.00,
  `total_reviews` INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_plumb_mobile` (`mobile_number`),
  KEY `idx_plumb_approval` (`approval_status`),
  KEY `idx_plumb_pin` (`pin_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Admin Users Table
CREATE TABLE IF NOT EXISTS `admin_users` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `full_name` VARCHAR(120) NOT NULL,
  `email` VARCHAR(150) NOT NULL,
  `mobile_number` VARCHAR(15) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('super_admin', 'admin') NOT NULL DEFAULT 'admin',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `last_login_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_admin_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. OTP Verifications Table (SMS Gateway Agnostic)
CREATE TABLE IF NOT EXISTS `otp_verifications` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `mobile_number` VARCHAR(15) NOT NULL,
  `role` ENUM('user', 'electrician', 'plumber') NOT NULL,
  `otp_code` VARCHAR(10) NOT NULL,
  `purpose` ENUM('registration', 'login', 'reset') NOT NULL DEFAULT 'registration',
  `is_used` TINYINT(1) NOT NULL DEFAULT 0,
  `expires_at` DATETIME NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_otp_lookup` (`mobile_number`, `role`, `is_used`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Provider Documents Table
CREATE TABLE IF NOT EXISTS `provider_documents` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `provider_type` ENUM('electrician', 'plumber') NOT NULL,
  `provider_id` INT UNSIGNED NOT NULL,
  `document_type` ENUM('qualification_certificate', 'experience_certificate', 'police_verification') NOT NULL,
  `file_path` VARCHAR(255) NOT NULL,
  `original_name` VARCHAR(180) NOT NULL,
  `verification_status` ENUM('pending', 'verified', 'rejected') NOT NULL DEFAULT 'pending',
  `verified_by_admin_id` INT UNSIGNED NULL,
  `verified_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_doc_provider` (`provider_type`, `provider_id`),
  CONSTRAINT `fk_doc_admin` FOREIGN KEY (`verified_by_admin_id`) REFERENCES `admin_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Bookings Table
CREATE TABLE IF NOT EXISTS `bookings` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `booking_code` VARCHAR(32) NOT NULL,
  `user_id` INT UNSIGNED NOT NULL,
  `service_category` ENUM('electrician', 'plumber') NOT NULL,
  `booking_method` ENUM('online', 'phone_manual') NOT NULL DEFAULT 'online',
  `assigned_provider_type` ENUM('electrician', 'plumber') NULL,
  `assigned_provider_id` INT UNSIGNED NULL,
  `problem_description` TEXT NOT NULL,
  `service_address` TEXT NOT NULL,
  `preferred_date` DATE NOT NULL,
  `preferred_time` VARCHAR(40) NOT NULL,
  `booking_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `status` ENUM(
    'Payment Pending',
    'Booking Confirmed',
    'Waiting for Electrician',
    'Accepted',
    'In Progress',
    'Work Completed',
    'Customer Review Pending',
    'Completed and Reviewed',
    'Cancelled'
  ) NOT NULL DEFAULT 'Payment Pending',
  `completion_description` TEXT NULL,
  `customer_confirmed_completion` TINYINT(1) NOT NULL DEFAULT 0,
  `created_by_admin_id` INT UNSIGNED NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_booking_code` (`booking_code`),
  KEY `idx_booking_user` (`user_id`),
  KEY `idx_booking_provider` (`assigned_provider_type`, `assigned_provider_id`),
  KEY `idx_booking_status` (`status`),
  CONSTRAINT `fk_booking_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_booking_admin` FOREIGN KEY (`created_by_admin_id`) REFERENCES `admin_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Booking Problem Images Table
CREATE TABLE IF NOT EXISTS `booking_images` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `booking_id` INT UNSIGNED NOT NULL,
  `file_path` VARCHAR(255) NOT NULL,
  `original_name` VARCHAR(180) NOT NULL,
  `uploaded_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_bimg_booking` (`booking_id`),
  CONSTRAINT `fk_bimg_booking` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Booking Status History Table
CREATE TABLE IF NOT EXISTS `booking_status_history` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `booking_id` INT UNSIGNED NOT NULL,
  `status` VARCHAR(60) NOT NULL,
  `changed_by_role` ENUM('user', 'electrician', 'plumber', 'admin', 'system') NOT NULL,
  `changed_by_id` INT UNSIGNED NULL,
  `remarks` TEXT NULL,
  `changed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_bsh_booking` (`booking_id`),
  CONSTRAINT `fk_bsh_booking` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Payments Table (Razorpay & Manual Verified Payments)
CREATE TABLE IF NOT EXISTS `payments` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `booking_id` INT UNSIGNED NOT NULL,
  `user_id` INT UNSIGNED NOT NULL,
  `amount` DECIMAL(10,2) NOT NULL,
  `currency` VARCHAR(10) NOT NULL DEFAULT 'INR',
  `razorpay_order_id` VARCHAR(100) NULL,
  `razorpay_payment_id` VARCHAR(100) NULL,
  `razorpay_signature` VARCHAR(255) NULL,
  `payment_method` VARCHAR(50) NOT NULL DEFAULT 'razorpay',
  `payment_status` ENUM('pending', 'success', 'failed') NOT NULL DEFAULT 'pending',
  `failure_reason` TEXT NULL,
  `paid_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_rzp_payment_id` (`razorpay_payment_id`),
  KEY `idx_pay_booking` (`booking_id`),
  KEY `idx_pay_user` (`user_id`),
  KEY `idx_pay_status` (`payment_status`),
  CONSTRAINT `fk_pay_booking` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_pay_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Electrician / Plumber Service Charges Table (Admin Assigned)
CREATE TABLE IF NOT EXISTS `electrician_service_charges` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `booking_id` INT UNSIGNED NOT NULL,
  `provider_type` ENUM('electrician', 'plumber') NOT NULL,
  `provider_id` INT UNSIGNED NOT NULL,
  `assigned_charge` DECIMAL(10,2) NOT NULL,
  `payout_status` ENUM('pending', 'paid') NOT NULL DEFAULT 'pending',
  `assigned_by_admin_id` INT UNSIGNED NOT NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_charge_booking` (`booking_id`),
  KEY `idx_charge_provider` (`provider_type`, `provider_id`),
  CONSTRAINT `fk_charge_booking` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_charge_admin` FOREIGN KEY (`assigned_by_admin_id`) REFERENCES `admin_users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Electrician / Plumber Payouts Table (Manual Admin Payouts)
CREATE TABLE IF NOT EXISTS `electrician_payouts` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `service_charge_id` INT UNSIGNED NOT NULL,
  `booking_id` INT UNSIGNED NOT NULL,
  `provider_type` ENUM('electrician', 'plumber') NOT NULL,
  `provider_id` INT UNSIGNED NOT NULL,
  `paid_amount` DECIMAL(10,2) NOT NULL,
  `utr_reference` VARCHAR(120) NOT NULL,
  `payment_mode` VARCHAR(50) NOT NULL DEFAULT 'UPI/Bank Transfer',
  `payment_date` DATE NOT NULL,
  `paid_by_admin_id` INT UNSIGNED NOT NULL,
  `remarks` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_payout_provider` (`provider_type`, `provider_id`),
  CONSTRAINT `fk_payout_charge` FOREIGN KEY (`service_charge_id`) REFERENCES `electrician_service_charges` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_payout_booking` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_payout_admin` FOREIGN KEY (`paid_by_admin_id`) REFERENCES `admin_users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. Work Completion Photos Table
CREATE TABLE IF NOT EXISTS `work_completion_photos` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `booking_id` INT UNSIGNED NOT NULL,
  `provider_type` ENUM('electrician', 'plumber') NOT NULL,
  `provider_id` INT UNSIGNED NOT NULL,
  `file_path` VARCHAR(255) NOT NULL,
  `original_name` VARCHAR(180) NOT NULL,
  `uploaded_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_wcp_booking` (`booking_id`),
  CONSTRAINT `fk_wcp_booking` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. Customer Reviews Table
CREATE TABLE IF NOT EXISTS `customer_reviews` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `booking_id` INT UNSIGNED NOT NULL,
  `user_id` INT UNSIGNED NOT NULL,
  `provider_type` ENUM('electrician', 'plumber') NOT NULL,
  `provider_id` INT UNSIGNED NOT NULL,
  `rating` TINYINT UNSIGNED NOT NULL,
  `service_quality` TINYINT UNSIGNED NOT NULL,
  `provider_behaviour` TINYINT UNSIGNED NOT NULL,
  `work_satisfaction` TINYINT UNSIGNED NOT NULL,
  `written_feedback` TEXT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_review_booking` (`booking_id`),
  KEY `idx_rev_provider` (`provider_type`, `provider_id`),
  CONSTRAINT `fk_rev_booking` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_rev_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. Notifications Table
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `recipient_role` ENUM('user', 'electrician', 'plumber', 'admin') NOT NULL,
  `recipient_id` INT UNSIGNED NULL,
  `event_type` VARCHAR(80) NOT NULL,
  `title` VARCHAR(180) NOT NULL,
  `message` TEXT NOT NULL,
  `related_booking_id` INT UNSIGNED NULL,
  `is_read` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notif_recipient` (`recipient_role`, `recipient_id`, `is_read`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Initial Admin Account (Password: Admin@123 — change immediately after deployment)
INSERT INTO `admin_users` (`full_name`, `email`, `mobile_number`, `password_hash`, `role`)
VALUES (
  'System Administrator',
  'admin@voltvalve.in',
  '9999999999',
  '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'super_admin'
) ON DUPLICATE KEY UPDATE `email` = `email`;

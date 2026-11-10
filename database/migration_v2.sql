-- Volt & Valve - Non-Destructive Database Migration v2
-- Adds: service_categories, services, gift_vouchers, voucher_assignments, voucher_redemptions, review_visibility_logs
-- Preserves all existing users, bookings, payments, providers, and reviews.

SET time_zone = "+05:30";

-- 1. Service Categories Table
CREATE TABLE IF NOT EXISTS `service_categories` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `slug` VARCHAR(60) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `display_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_cat_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `service_categories` (`slug`, `name`, `is_active`, `display_order`) VALUES
('electrician', 'Electrician', 1, 1),
('plumber', 'Plumber', 1, 2);

-- 2. Services Table
CREATE TABLE IF NOT EXISTS `services` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `category_id` INT UNSIGNED NOT NULL,
  `service_name` VARCHAR(150) NOT NULL,
  `description` TEXT NOT NULL,
  `image_path` VARCHAR(255) NULL,
  `price` DECIMAL(10,2) NOT NULL DEFAULT 299.00,
  `pricing_type` ENUM('fixed', 'starting_at', 'inspection') NOT NULL DEFAULT 'fixed',
  `is_available` TINYINT(1) NOT NULL DEFAULT 1,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `display_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_service_cat` (`category_id`),
  KEY `idx_service_active` (`is_active`, `display_order`),
  CONSTRAINT `fk_service_category` FOREIGN KEY (`category_id`) REFERENCES `service_categories` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Gift Vouchers Table
CREATE TABLE IF NOT EXISTS `gift_vouchers` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `voucher_name` VARCHAR(120) NOT NULL,
  `voucher_code` VARCHAR(40) NOT NULL,
  `description` TEXT NULL,
  `discount_type` ENUM('fixed', 'percentage') NOT NULL DEFAULT 'fixed',
  `discount_value` DECIMAL(10,2) NOT NULL,
  `min_booking_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `max_discount_amount` DECIMAL(10,2) NULL,
  `start_date` DATE NOT NULL,
  `expiry_date` DATE NOT NULL,
  `total_usage_limit` INT UNSIGNED NOT NULL DEFAULT 100,
  `per_user_limit` INT UNSIGNED NOT NULL DEFAULT 1,
  `applicable_scope` ENUM('all_services', 'specific_services') NOT NULL DEFAULT 'all_services',
  `applicable_service_ids` TEXT NULL,
  `target_audience` ENUM('all_users', 'specific_users') NOT NULL DEFAULT 'all_users',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_by_admin_id` INT UNSIGNED NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_voucher_code` (`voucher_code`),
  KEY `idx_voucher_active_dates` (`is_active`, `start_date`, `expiry_date`),
  CONSTRAINT `fk_voucher_admin` FOREIGN KEY (`created_by_admin_id`) REFERENCES `admin_users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Voucher Assignments Table (for specific users)
CREATE TABLE IF NOT EXISTS `voucher_assignments` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `voucher_id` INT UNSIGNED NOT NULL,
  `user_id` INT UNSIGNED NOT NULL,
  `assigned_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_voucher_user` (`voucher_id`, `user_id`),
  CONSTRAINT `fk_va_voucher` FOREIGN KEY (`voucher_id`) REFERENCES `gift_vouchers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_va_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Voucher Redemptions Table
CREATE TABLE IF NOT EXISTS `voucher_redemptions` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `voucher_id` INT UNSIGNED NOT NULL,
  `user_id` INT UNSIGNED NOT NULL,
  `booking_id` INT UNSIGNED NOT NULL,
  `original_amount` DECIMAL(10,2) NOT NULL,
  `discount_amount` DECIMAL(10,2) NOT NULL,
  `final_amount` DECIMAL(10,2) NOT NULL,
  `redeemed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_vr_booking` (`booking_id`),
  KEY `idx_vr_voucher_user` (`voucher_id`, `user_id`),
  CONSTRAINT `fk_vr_voucher` FOREIGN KEY (`voucher_id`) REFERENCES `gift_vouchers` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_vr_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_vr_booking` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Review Visibility Logs Table
CREATE TABLE IF NOT EXISTS `review_visibility_logs` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `review_id` INT UNSIGNED NOT NULL,
  `admin_id` INT UNSIGNED NOT NULL,
  `action` ENUM('hidden', 'unhidden') NOT NULL,
  `reason` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_rvl_review` (`review_id`),
  CONSTRAINT `fk_rvl_review` FOREIGN KEY (`review_id`) REFERENCES `customer_reviews` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rvl_admin` FOREIGN KEY (`admin_id`) REFERENCES `admin_users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Non-destructive column additions to existing tables
ALTER TABLE `customer_reviews`
  ADD COLUMN IF NOT EXISTS `is_visible` TINYINT(1) NOT NULL DEFAULT 1;

ALTER TABLE `bookings`
  ADD COLUMN IF NOT EXISTS `service_id` INT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS `voucher_id` INT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS `original_amount` DECIMAL(10,2) NULL,
  ADD COLUMN IF NOT EXISTS `discount_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00;

ALTER TABLE `payments`
  ADD COLUMN IF NOT EXISTS `webhook_verified` TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `razorpay_event_id` VARCHAR(100) NULL;

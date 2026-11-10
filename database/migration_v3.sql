-- Volt & Valve - Non-Destructive Database Migration v3
-- Adds: user profile_image, hourly/custom_quote pricing types, booking price snapshots, payment created/refunded statuses
-- Preserves all existing users, bookings, payments, services, vouchers, and reviews.

ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `profile_image` VARCHAR(255) NULL AFTER `pin_code`;

ALTER TABLE `services`
  MODIFY COLUMN `pricing_type` ENUM('fixed', 'starting_at', 'hourly', 'custom_quote', 'inspection') NOT NULL DEFAULT 'fixed';

ALTER TABLE `bookings`
  ADD COLUMN IF NOT EXISTS `service_name_snapshot` VARCHAR(150) NULL AFTER `service_id`,
  ADD COLUMN IF NOT EXISTS `service_price_snapshot` DECIMAL(10,2) NULL AFTER `service_name_snapshot`;

ALTER TABLE `payments`
  MODIFY COLUMN `payment_status` ENUM('created', 'pending', 'success', 'failed', 'refunded') NOT NULL DEFAULT 'created',
  ADD COLUMN IF NOT EXISTS `refunded_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER `failure_reason`,
  ADD COLUMN IF NOT EXISTS `refund_reason` TEXT NULL AFTER `refunded_amount`,
  ADD COLUMN IF NOT EXISTS `refunded_at` DATETIME NULL AFTER `refund_reason`;

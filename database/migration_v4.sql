-- Volt & Valve - Non-Destructive Migration v4
-- Adds secure server-side storage for Razorpay Test Mode credentials
-- Safe to run on existing database; preserves all existing tables and records.

CREATE TABLE IF NOT EXISTS payment_gateway_settings (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  gateway_name VARCHAR(50) NOT NULL UNIQUE,
  payment_mode ENUM('test') NOT NULL DEFAULT 'test',
  test_key_id VARCHAR(120) NOT NULL DEFAULT '',
  test_key_secret_enc TEXT NOT NULL,
  is_configured TINYINT(1) NOT NULL DEFAULT 0,
  last_tested_at TIMESTAMP NULL DEFAULT NULL,
  last_test_status VARCHAR(40) NULL DEFAULT NULL,
  last_test_message VARCHAR(255) NULL DEFAULT NULL,
  updated_by_admin_id INT UNSIGNED NULL DEFAULT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT IGNORE INTO payment_gateway_settings (gateway_name, payment_mode, test_key_id, test_key_secret_enc, is_configured)
VALUES ('razorpay', 'test', '', '', 0);

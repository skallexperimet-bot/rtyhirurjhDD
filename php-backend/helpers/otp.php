<?php
require_once __DIR__ . '/../config/config.php';

/**
 * Generates a 6-digit OTP, stores it in otp_verifications, and dispatches via SMS gateway if configured.
 */
function generateAndSendOtp(PDO $pdo, string $mobile, string $role, string $purpose = 'registration'): array {
    $otp = str_pad((string)random_int(100000, 999999), 6, '0', STR_PAD_LEFT);
    $expiresAt = date('Y-m-d H:i:s', time() + 600); // 10 minutes

    // Invalidate previous unused OTPs for this mobile & role
    $inv = $pdo->prepare("UPDATE otp_verifications SET is_used = 1 WHERE mobile_number = ? AND role = ? AND is_used = 0");
    $inv->execute([$mobile, $role]);

    $stmt = $pdo->prepare("
        INSERT INTO otp_verifications (mobile_number, role, otp_code, purpose, expires_at)
        VALUES (?, ?, ?, ?, ?)
    ");
    $stmt->execute([$mobile, $role, $otp, $purpose, $expiresAt]);

    $dispatched = false;
    if (SMS_GATEWAY_ENABLED && SMS_API_KEY !== '') {
        $dispatched = dispatchSmsGateway($mobile, "Your Volt & Valve verification OTP is {$otp}. Valid for 10 minutes.");
    }

    return [
        'sent' => true,
        'sms_gateway_dispatched' => $dispatched,
        // Only expose debug_otp when SMS gateway is not yet enabled (for pre-integration testing)
        'debug_otp' => SMS_GATEWAY_ENABLED ? null : $otp,
    ];
}

function verifyOtpCode(PDO $pdo, string $mobile, string $role, string $otp): bool {
    $stmt = $pdo->prepare("
        SELECT id, expires_at FROM otp_verifications
        WHERE mobile_number = ? AND role = ? AND otp_code = ? AND is_used = 0
        ORDER BY id DESC LIMIT 1
    ");
    $stmt->execute([$mobile, $role, $otp]);
    $row = $stmt->fetch();
    if (!$row) {
        return false;
    }
    if (strtotime($row['expires_at']) < time()) {
        return false;
    }
    $upd = $pdo->prepare("UPDATE otp_verifications SET is_used = 1 WHERE id = ?");
    $upd->execute([$row['id']]);
    return true;
}

/**
 * Adapter for future SMS OTP API integration (MSG91 / Fast2SMS / Twilio).
 */
function dispatchSmsGateway(string $mobile, string $message): bool {
    // Implement cURL call to selected SMS provider here when SMS_GATEWAY_ENABLED = true
    return false;
}

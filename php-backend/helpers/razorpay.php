<?php
require_once __DIR__ . '/../config/config.php';

/**
 * Creates a Razorpay Order using server-side secret keys via cURL.
 */
function createRazorpayOrder(float $amountInr, string $receiptId): array {
    $cfg = getRazorpayConfig();
    if (!$cfg['is_configured']) {
        return ['error' => 'Razorpay ' . strtoupper($cfg['mode']) . ' API credentials are not configured on the server.'];
    }

    $amountPaise = (int)round($amountInr * 100);
    if ($amountPaise < 100) {
        return ['error' => 'Minimum payable amount is INR 1.00 (100 paise).'];
    }

    $payload = json_encode([
        'amount' => $amountPaise,
        'currency' => 'INR',
        'receipt' => $receiptId,
        'payment_capture' => 1,
    ]);

    $ch = curl_init('https://api.razorpay.com/v1/orders');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_USERPWD => $cfg['key_id'] . ':' . $cfg['key_secret'],
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_TIMEOUT => 20,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr = curl_error($ch);
    curl_close($ch);

    if ($curlErr || $httpCode < 200 || $httpCode >= 300) {
        return ['error' => 'Unable to create Razorpay order.', 'details' => $curlErr ?: $response];
    }

    return json_decode($response, true) ?: ['error' => 'Invalid Razorpay response'];
}

/**
 * Verifies Razorpay Payment Signature using HMAC-SHA256 on the server.
 */
function verifyRazorpaySignature(string $orderId, string $paymentId, string $signature): bool {
    $cfg = getRazorpayConfig();
    if (!$cfg['is_configured']) {
        return false;
    }
    $expected = hash_hmac('sha256', $orderId . '|' . $paymentId, $cfg['key_secret']);
    return hash_equals($expected, $signature);
}

/**
 * Fetches payments for a Razorpay Order directly from Razorpay API.
 * Used when the user's browser closes or network drops after paying.
 */
function fetchRazorpayOrderPayments(string $orderId): array {
    $cfg = getRazorpayConfig();
    if (!$cfg['is_configured']) {
        return ['error' => 'Razorpay credentials not configured.'];
    }

    $ch = curl_init('https://api.razorpay.com/v1/orders/' . urlencode($orderId) . '/payments');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_USERPWD => $cfg['key_id'] . ':' . $cfg['key_secret'],
        CURLOPT_TIMEOUT => 20,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr = curl_error($ch);
    curl_close($ch);

    if ($curlErr || $httpCode < 200 || $httpCode >= 300) {
        return ['error' => 'Unable to fetch order payments from Razorpay.', 'details' => $curlErr ?: $response];
    }

    return json_decode($response, true) ?: ['error' => 'Invalid Razorpay response'];
}

/**
 * Verifies Razorpay Test API connectivity and credentials via GET /v1/orders?count=1.
 */
function testRazorpayConnection(string $keyId, string $keySecret): array {
    if (strpos($keyId, 'rzp_test_') !== 0) {
        return ['connected' => false, 'message' => 'Test Key ID must start with rzp_test_.'];
    }
    if ($keySecret === '') {
        return ['connected' => false, 'message' => 'Test Key Secret is required.'];
    }

    $ch = curl_init('https://api.razorpay.com/v1/orders?count=1');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_USERPWD => $keyId . ':' . $keySecret,
        CURLOPT_TIMEOUT => 15,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr = curl_error($ch);
    curl_close($ch);

    if ($curlErr) {
        return ['connected' => false, 'message' => 'Network error contacting Razorpay: ' . $curlErr, 'http_code' => 0];
    }

    if ($httpCode >= 200 && $httpCode < 300) {
        return ['connected' => true, 'message' => 'Razorpay Test Mode API connection verified successfully.', 'http_code' => $httpCode];
    }

    $decoded = json_decode($response, true);
    $errMsg = $decoded['error']['description'] ?? 'Invalid Razorpay Test Key ID or Secret.';
    return ['connected' => false, 'message' => $errMsg, 'http_code' => $httpCode];
}

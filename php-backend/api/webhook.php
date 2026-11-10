<?php
require_once __DIR__ . '/../helpers/auth.php';

/**
 * Razorpay Server-Side Webhook Handler
 * Verifies X-Razorpay-Signature using RAZORPAY_WEBHOOK_SECRET.
 */
$rawBody = file_get_contents('php://input');
$signature = $_SERVER['HTTP_X_RAZORPAY_SIGNATURE'] ?? '';

if ($signature === '' || RAZORPAY_WEBHOOK_SECRET === '' || strpos(RAZORPAY_WEBHOOK_SECRET, 'REPLACE_WITH') !== false) {
    jsonResponse(['error' => 'Missing webhook signature or configuration.'], 400);
}

$expected = hash_hmac('sha256', $rawBody, RAZORPAY_WEBHOOK_SECRET);
if (!hash_equals($expected, $signature)) {
    jsonResponse(['error' => 'Invalid Razorpay webhook signature.'], 401);
}

$event = json_decode($rawBody, true);
if (!is_array($event)) {
    jsonResponse(['error' => 'Invalid JSON payload.'], 400);
}

$pdo = getDB();
$eventType = $event['event'] ?? '';
$paymentEntity = $event['payload']['payment']['entity'] ?? null;
$refundEntity = $event['payload']['refund']['entity'] ?? null;

if ($eventType === 'refund.processed' || $eventType === 'refund.created') {
    $refundPaymentId = $refundEntity['payment_id'] ?? ($paymentEntity['id'] ?? '');
    $refundAmountInr = isset($refundEntity['amount']) ? ((float)$refundEntity['amount'] / 100.0) : null;
    if ($refundPaymentId !== '') {
        $stmt = $pdo->prepare("SELECT * FROM payments WHERE razorpay_payment_id = ? LIMIT 1");
        $stmt->execute([$refundPaymentId]);
        $pRow = $stmt->fetch();
        if ($pRow && $pRow['payment_status'] !== 'refunded') {
            $amt = $refundAmountInr ?? (float)$pRow['amount'];
            $pdo->prepare("
                UPDATE payments
                SET payment_status = 'refunded', refunded_amount = ?, refund_reason = 'Processed via Razorpay Webhook', refunded_at = NOW(), webhook_verified = 1
                WHERE id = ?
            ")->execute([$amt, $pRow['id']]);
            createNotification($pdo, 'admin', null, 'payment_refunded', 'Webhook Refund Processed', "Payment {$refundPaymentId} refunded (INR {$amt}).", (int)$pRow['booking_id']);
        }
    }
    jsonResponse(['status' => 'ok']);
}

if (!$paymentEntity) {
    jsonResponse(['status' => 'ignored']);
}

$orderId = $paymentEntity['order_id'] ?? '';
$paymentId = $paymentEntity['id'] ?? '';
$method = $paymentEntity['method'] ?? 'razorpay';
$paidPaise = (int)($paymentEntity['amount'] ?? 0);

if ($orderId === '') {
    jsonResponse(['status' => 'no_order_id']);
}

$stmt = $pdo->prepare("SELECT * FROM payments WHERE razorpay_order_id = ? LIMIT 1");
$stmt->execute([$orderId]);
$payment = $stmt->fetch();

if (!$payment) {
    jsonResponse(['status' => 'order_not_found']);
}

$expectedPaise = (int)round((float)$payment['amount'] * 100);

if ($eventType === 'payment.captured' && $payment['payment_status'] !== 'success') {
    if ($paidPaise !== $expectedPaise) {
        $pdo->prepare("
            UPDATE payments SET payment_status = 'failed', failure_reason = 'Webhook amount mismatch', webhook_verified = 1 WHERE id = ?
        ")->execute([$payment['id']]);
        jsonResponse(['error' => 'Amount mismatch.'], 400);
    }

    $pdo->beginTransaction();
    try {
        $pdo->prepare("
            UPDATE payments
            SET razorpay_payment_id = ?, payment_method = ?, payment_status = 'success', webhook_verified = 1, paid_at = NOW()
            WHERE id = ? AND payment_status != 'success'
        ")->execute([$paymentId, $method, $payment['id']]);

        $pdo->prepare("UPDATE bookings SET status = 'Booking Confirmed' WHERE id = ? AND status = 'Payment Pending'")
            ->execute([$payment['booking_id']]);

        recordBookingStatus($pdo, (int)$payment['booking_id'], 'Booking Confirmed', 'system', null, "Confirmed via Razorpay webhook ({$paymentId}).");
        createNotification($pdo, 'admin', null, 'payment_success', 'Webhook Payment Captured', "Order {$orderId} captured ({$paymentId}).", (int)$payment['booking_id']);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        jsonResponse(['error' => 'Webhook processing error.'], 500);
    }
} elseif ($eventType === 'payment.failed' && in_array($payment['payment_status'], ['created', 'pending'], true)) {
    $reason = $paymentEntity['error_description'] ?? 'Payment failed at gateway.';
    $pdo->prepare("
        UPDATE payments
        SET razorpay_payment_id = ?, payment_status = 'failed', failure_reason = ?, webhook_verified = 1
        WHERE id = ?
    ")->execute([$paymentId, $reason, $payment['id']]);
    createNotification($pdo, 'admin', null, 'payment_failed', 'Webhook Payment Failed', "Order {$orderId}: {$reason}", (int)$payment['booking_id']);
}

jsonResponse(['status' => 'ok']);

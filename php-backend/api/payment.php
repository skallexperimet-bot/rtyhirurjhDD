<?php
require_once __DIR__ . '/../helpers/auth.php';
require_once __DIR__ . '/../helpers/razorpay.php';

$action = $_GET['action'] ?? '';
$pdo = getDB();

if ($action === 'get_active_key') {
    requireAuth(['user', 'admin']);
    $cfg = getRazorpayConfig();
    jsonResponse([
        'key_id' => $cfg['is_configured'] ? $cfg['key_id'] : '',
        'mode' => $cfg['mode'],
        'is_configured' => $cfg['is_configured'],
    ]);
}

if ($action === 'create_order') {
    $auth = requireAuth(['user', 'admin']);
    $data = getJsonInput();
    $bookingId = (int)($data['booking_id'] ?? 0);

    $stmt = $pdo->prepare("SELECT * FROM bookings WHERE id = ?");
    $stmt->execute([$bookingId]);
    $booking = $stmt->fetch();
    if (!$booking) {
        jsonResponse(['error' => 'Booking not found.'], 404);
    }
    if ($auth['role'] === 'user' && (int)$booking['user_id'] !== $auth['id']) {
        jsonResponse(['error' => 'Unauthorized access to booking.'], 403);
    }
    if ($booking['status'] !== 'Payment Pending') {
        jsonResponse(['error' => 'Booking is not awaiting payment.'], 409);
    }

    // Prevent duplicate payment processing
    $paidStmt = $pdo->prepare("SELECT id FROM payments WHERE booking_id = ? AND payment_status = 'success'");
    $paidStmt->execute([$bookingId]);
    if ($paidStmt->fetch()) {
        jsonResponse(['error' => 'Booking is already paid.'], 409);
    }

    // Always use server-computed booking_amount from MySQL
    $order = createRazorpayOrder((float)$booking['booking_amount'], $booking['booking_code']);
    if (isset($order['error'])) {
        jsonResponse($order, 502);
    }

    $pStmt = $pdo->prepare("
        INSERT INTO payments (booking_id, user_id, amount, currency, razorpay_order_id, payment_status)
        VALUES (?, ?, ?, 'INR', ?, 'created')
    ");
    $pStmt->execute([$bookingId, $booking['user_id'], $booking['booking_amount'], $order['id']]);

    $cfg = getRazorpayConfig();
    jsonResponse([
        'order_id' => $order['id'],
        'amount' => $order['amount'],
        'currency' => $order['currency'],
        'key_id' => $cfg['key_id'], // Public Key ID only — NEVER return key_secret
        'mode' => $cfg['mode'],
    ]);
}

if ($action === 'mark_pending') {
    $auth = requireAuth(['user', 'admin']);
    $data = getJsonInput();
    $orderId = trim($data['razorpay_order_id'] ?? '');
    if ($orderId !== '') {
        $pdo->prepare("UPDATE payments SET payment_status = 'pending' WHERE razorpay_order_id = ? AND payment_status = 'created'")
            ->execute([$orderId]);
    }
    jsonResponse(['success' => true]);
}

if ($action === 'record_failure') {
    $auth = requireAuth(['user', 'admin']);
    $data = getJsonInput();
    $orderId = trim($data['razorpay_order_id'] ?? '');
    $bookingId = (int)($data['booking_id'] ?? 0);
    $reason = trim($data['reason'] ?? 'Payment cancelled or failed at Razorpay Checkout.');
    if ($orderId !== '') {
        $pdo->prepare("UPDATE payments SET payment_status = 'failed', failure_reason = ? WHERE razorpay_order_id = ? AND payment_status IN ('created', 'pending')")
            ->execute([$reason, $orderId]);
        createNotification($pdo, 'admin', null, 'payment_failed', 'Customer Payment Failed', "Order {$orderId}: {$reason}", $bookingId ?: null);
    }
    jsonResponse(['success' => true]);
}

if ($action === 'verify_payment') {
    $auth = requireAuth(['user', 'admin']);
    $data = getJsonInput();
    $bookingId = (int)($data['booking_id'] ?? 0);
    $orderId = trim($data['razorpay_order_id'] ?? '');
    $paymentId = trim($data['razorpay_payment_id'] ?? '');
    $signature = trim($data['razorpay_signature'] ?? '');

    if (!$bookingId || !$orderId || !$paymentId || !$signature) {
        jsonResponse(['error' => 'Missing Razorpay verification parameters.'], 422);
    }

    // Verify payment row belongs to booking & order
    $payStmt = $pdo->prepare("SELECT * FROM payments WHERE razorpay_order_id = ? AND booking_id = ? LIMIT 1");
    $payStmt->execute([$orderId, $bookingId]);
    $paymentRow = $payStmt->fetch();
    if (!$paymentRow) {
        jsonResponse(['error' => 'Matching payment order record not found for this booking.'], 404);
    }

    if ($auth['role'] === 'user' && (int)$paymentRow['user_id'] !== $auth['id']) {
        jsonResponse(['error' => 'Unauthorized payment verification attempt.'], 403);
    }

    // Prevent duplicate Razorpay payment ID or duplicate successful booking confirmation
    $dupStmt = $pdo->prepare("SELECT id FROM payments WHERE (razorpay_payment_id = ? OR booking_id = ?) AND payment_status = 'success' LIMIT 1");
    $dupStmt->execute([$paymentId, $bookingId]);
    if ($dupStmt->fetch()) {
        jsonResponse(['success' => true, 'message' => 'Payment already verified and booking confirmed.', 'duplicate' => true]);
    }

    if (!verifyRazorpaySignature($orderId, $paymentId, $signature)) {
        $failStmt = $pdo->prepare("UPDATE payments SET payment_status = 'failed', failure_reason = 'Invalid signature' WHERE razorpay_order_id = ? AND payment_status != 'success'");
        $failStmt->execute([$orderId]);
        createNotification($pdo, 'admin', null, 'payment_failed', 'Payment Verification Failed', "Signature mismatch for booking #{$bookingId}", $bookingId);
        jsonResponse(['error' => 'Payment signature verification failed.'], 400);
    }

    $pdo->beginTransaction();
    try {
        $updPay = $pdo->prepare("
            UPDATE payments
            SET razorpay_payment_id = ?, razorpay_signature = ?, payment_status = 'success', paid_at = NOW()
            WHERE id = ? AND payment_status != 'success'
        ");
        $updPay->execute([$paymentId, $signature, $paymentRow['id']]);

        $updBook = $pdo->prepare("UPDATE bookings SET status = 'Booking Confirmed' WHERE id = ? AND status = 'Payment Pending'");
        $updBook->execute([$bookingId]);

        recordBookingStatus($pdo, $bookingId, 'Booking Confirmed', $auth['role'], $auth['id'], "Razorpay Payment Verified: {$paymentId}");

        $bStmt = $pdo->prepare("SELECT booking_code, user_id, booking_amount FROM bookings WHERE id = ?");
        $bStmt->execute([$bookingId]);
        $bRow = $bStmt->fetch();

        createNotification($pdo, 'admin', null, 'payment_success', 'Payment Verified', "Booking {$bRow['booking_code']} paid (INR {$bRow['booking_amount']}).", $bookingId);
        createNotification($pdo, 'user', (int)$bRow['user_id'], 'booking_confirmed', 'Booking Confirmed', "Your booking {$bRow['booking_code']} is confirmed.", $bookingId);

        $pdo->commit();
        jsonResponse(['success' => true, 'booking_code' => $bRow['booking_code'], 'status' => 'Booking Confirmed']);
    } catch (Throwable $e) {
        $pdo->rollBack();
        jsonResponse(['error' => 'Failed to finalize payment verification.'], 500);
    }
}

if ($action === 'check_status') {
    $auth = requireAuth(['user', 'admin']);
    $data = getJsonInput();
    $bookingId = (int)($data['booking_id'] ?? 0);
    $orderId = trim($data['razorpay_order_id'] ?? '');

    $stmt = $pdo->prepare("SELECT * FROM payments WHERE booking_id = ? AND (? = '' OR razorpay_order_id = ?) ORDER BY id DESC LIMIT 1");
    $stmt->execute([$bookingId, $orderId, $orderId]);
    $paymentRow = $stmt->fetch();
    if (!$paymentRow) {
        jsonResponse(['error' => 'No payment order found for this booking.'], 404);
    }
    if ($auth['role'] === 'user' && (int)$paymentRow['user_id'] !== $auth['id']) {
        jsonResponse(['error' => 'Unauthorized.'], 403);
    }
    if ($paymentRow['payment_status'] === 'success') {
        jsonResponse(['payment_status' => 'success', 'booking_status' => 'Booking Confirmed']);
    }

    $rzpPayments = fetchRazorpayOrderPayments($paymentRow['razorpay_order_id']);
    if (isset($rzpPayments['error'])) {
        jsonResponse(['payment_status' => $paymentRow['payment_status'], 'error' => $rzpPayments['error']], 502);
    }

    $expectedPaise = (int)round((float)$paymentRow['amount'] * 100);
    $capturedItem = null;
    foreach (($rzpPayments['items'] ?? []) as $item) {
        if (($item['status'] ?? '') === 'captured' && (int)($item['amount'] ?? 0) === $expectedPaise) {
            $capturedItem = $item;
            break;
        }
    }

    if ($capturedItem) {
        $pdo->beginTransaction();
        try {
            $pdo->prepare("
                UPDATE payments
                SET razorpay_payment_id = ?, payment_method = ?, payment_status = 'success', paid_at = NOW()
                WHERE id = ? AND payment_status != 'success'
            ")->execute([$capturedItem['id'], $capturedItem['method'] ?? 'razorpay', $paymentRow['id']]);

            $pdo->prepare("UPDATE bookings SET status = 'Booking Confirmed' WHERE id = ? AND status = 'Payment Pending'")
                ->execute([$bookingId]);

            recordBookingStatus($pdo, $bookingId, 'Booking Confirmed', 'system', null, "Recovered via Razorpay Order API ({$capturedItem['id']}).");
            $pdo->commit();
            jsonResponse(['payment_status' => 'success', 'booking_status' => 'Booking Confirmed', 'razorpay_payment_id' => $capturedItem['id']]);
        } catch (Throwable $e) {
            $pdo->rollBack();
            jsonResponse(['error' => 'Failed to sync captured payment.'], 500);
        }
    }

    jsonResponse(['payment_status' => $paymentRow['payment_status'], 'booking_status' => 'Payment Pending']);
}

jsonResponse(['error' => 'Unknown payment action.'], 400);

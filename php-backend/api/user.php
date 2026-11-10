<?php
require_once __DIR__ . '/../helpers/auth.php';
require_once __DIR__ . '/../helpers/upload.php';

$auth = requireAuth(['user']);
$userId = $auth['id'];
$action = $_GET['action'] ?? '';
$pdo = getDB();

if ($action === 'dashboard') {
    $uStmt = $pdo->prepare("SELECT id, full_name, mobile_number, address, village_city, district, state, pin_code, status, created_at FROM users WHERE id = ?");
    $uStmt->execute([$userId]);
    $profile = $uStmt->fetch();

    $bStmt = $pdo->prepare("SELECT * FROM bookings WHERE user_id = ? ORDER BY id DESC");
    $bStmt->execute([$userId]);
    $bookings = $bStmt->fetchAll();

    $pStmt = $pdo->prepare("SELECT p.*, b.booking_code, b.service_category FROM payments p JOIN bookings b ON b.id = p.booking_id WHERE p.user_id = ? ORDER BY p.id DESC");
    $pStmt->execute([$userId]);
    $payments = $pStmt->fetchAll();

    $nStmt = $pdo->prepare("SELECT * FROM notifications WHERE recipient_role = 'user' AND recipient_id = ? ORDER BY id DESC LIMIT 30");
    $nStmt->execute([$userId]);
    $notifications = $nStmt->fetchAll();

    jsonResponse([
        'profile' => $profile,
        'bookings' => $bookings,
        'payments' => $payments,
        'notifications' => $notifications,
    ]);
}

if ($action === 'update_profile') {
    $data = getJsonInput();
    $stmt = $pdo->prepare("
        UPDATE users SET full_name = ?, address = ?, village_city = ?, district = ?, state = ?, pin_code = ?
        WHERE id = ?
    ");
    $stmt->execute([
        trim($data['full_name'] ?? ''),
        trim($data['address'] ?? ''),
        trim($data['village_city'] ?? ''),
        trim($data['district'] ?? ''),
        trim($data['state'] ?? ''),
        trim($data['pin_code'] ?? ''),
        $userId,
    ]);
    jsonResponse(['success' => true]);
}

if ($action === 'create_booking') {
    $serviceId = isset($_POST['service_id']) && $_POST['service_id'] !== '' ? (int)$_POST['service_id'] : null;
    $voucherCode = strtoupper(trim($_POST['voucher_code'] ?? ''));
    $category = $_POST['service_category'] ?? '';
    $serviceNameSnapshot = null;

    if ($serviceId) {
        $sStmt = $pdo->prepare("
            SELECT s.*, c.slug AS category_slug
            FROM services s
            JOIN service_categories c ON c.id = s.category_id
            WHERE s.id = ? AND s.is_active = 1 AND s.is_available = 1
        ");
        $sStmt->execute([$serviceId]);
        $svc = $sStmt->fetch();
        if (!$svc) {
            jsonResponse(['error' => 'Selected service is unavailable or disabled.'], 422);
        }
        $category = $svc['category_slug'] === 'plumber' ? 'plumber' : 'electrician';
        $isCustomQuote = ($svc['pricing_type'] === 'custom_quote');
        $originalAmount = $isCustomQuote ? 0.00 : (float)$svc['price'];
        $serviceNameSnapshot = $svc['service_name'];
    } else {
        jsonResponse(['error' => 'Please select an active service from the service catalog.'], 422);
    }

    $discountAmount = 0.00;
    $voucherId = null;
    $finalAmount = $originalAmount;
    $initialStatus = $isCustomQuote ? 'Booking Confirmed' : 'Payment Pending';

    if (!$isCustomQuote && $voucherCode !== '') {
        $vStmt = $pdo->prepare("SELECT * FROM gift_vouchers WHERE UPPER(voucher_code) = ? AND is_active = 1 LIMIT 1");
        $vStmt->execute([$voucherCode]);
        $v = $vStmt->fetch();
        $today = date('Y-m-d');
        if (!$v || $today < $v['start_date'] || $today > $v['expiry_date'] || $originalAmount < (float)$v['min_booking_amount']) {
            jsonResponse(['error' => 'Voucher is invalid, expired, or does not meet minimum booking amount.'], 422);
        }
        $voucherId = (int)$v['id'];
        $discount = $v['discount_type'] === 'fixed' ? (float)$v['discount_value'] : ($originalAmount * (float)$v['discount_value']) / 100.0;
        if ($v['discount_type'] === 'percentage' && $v['max_discount_amount'] !== null) {
            $discount = min($discount, (float)$v['max_discount_amount']);
        }
        $discountAmount = round(min($discount, $originalAmount), 2);
        $finalAmount = max(1.00, round($originalAmount - $discountAmount, 2));
    }

    $bookingCode = 'VV-' . strtoupper(substr($category, 0, 2)) . '-' . date('ymd') . '-' . random_int(1000, 9999);

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare("
            INSERT INTO bookings (booking_code, user_id, service_category, service_id, service_name_snapshot, service_price_snapshot, voucher_id, original_amount, discount_amount, booking_method, problem_description, service_address, preferred_date, preferred_time, booking_amount, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'online', ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $bookingCode,
            $userId,
            $category,
            $serviceId,
            $serviceNameSnapshot,
            $originalAmount,
            $voucherId,
            $originalAmount,
            $discountAmount,
            trim($_POST['problem_description'] ?? ''),
            trim($_POST['service_address'] ?? ''),
            trim($_POST['preferred_date'] ?? date('Y-m-d')),
            trim($_POST['preferred_time'] ?? '10:00 AM'),
            $finalAmount,
            $initialStatus,
        ]);
        $bookingId = (int)$pdo->lastInsertId();

        if ($voucherId) {
            $pdo->prepare("INSERT INTO voucher_redemptions (voucher_id, user_id, booking_id, original_amount, discount_amount, final_amount) VALUES (?, ?, ?, ?, ?, ?)")
                ->execute([$voucherId, $userId, $bookingId, $originalAmount, $discountAmount, $finalAmount]);
        }

        if (!empty($_FILES['problem_photos']['name'][0])) {
            $count = count($_FILES['problem_photos']['name']);
            for ($i = 0; $i < $count; $i++) {
                $file = [
                    'name' => $_FILES['problem_photos']['name'][$i],
                    'type' => $_FILES['problem_photos']['type'][$i],
                    'tmp_name' => $_FILES['problem_photos']['tmp_name'][$i],
                    'error' => $_FILES['problem_photos']['error'][$i],
                    'size' => $_FILES['problem_photos']['size'][$i],
                ];
                $uploaded = handleSecureUpload($file, 'booking_photos', ALLOWED_IMAGE_MIMES);
                if (!isset($uploaded['error'])) {
                    $pdo->prepare("INSERT INTO booking_images (booking_id, file_path, original_name) VALUES (?, ?, ?)")
                        ->execute([$bookingId, $uploaded['file_path'], $uploaded['original_name']]);
                }
            }
        }

        $remark = $isCustomQuote
            ? 'Custom quotation requested. Final price will be confirmed after inspection.'
            : 'Online booking created, awaiting Razorpay payment.';
        recordBookingStatus($pdo, $bookingId, $initialStatus, 'user', $userId, $remark);
        createNotification($pdo, 'admin', null, 'new_booking', 'New Online Booking', "Booking {$bookingCode} created.", $bookingId);
        $pdo->commit();
        jsonResponse([
            'success' => true,
            'booking_id' => $bookingId,
            'booking_code' => $bookingCode,
            'requires_payment' => !$isCustomQuote,
        ], 201);
    } catch (Throwable $e) {
        $pdo->rollBack();
        jsonResponse(['error' => 'Failed to create booking.'], 500);
    }
}

if ($action === 'confirm_and_review') {
    $data = getJsonInput();
    $bookingId = (int)($data['booking_id'] ?? 0);
    $stmt = $pdo->prepare("SELECT * FROM bookings WHERE id = ? AND user_id = ?");
    $stmt->execute([$bookingId, $userId]);
    $booking = $stmt->fetch();

    if (!$booking || !in_array($booking['status'], ['Work Completed', 'Customer Review Pending'], true)) {
        jsonResponse(['error' => 'Booking is not eligible for completion review.'], 422);
    }

    $rating = max(1, min(5, (int)($data['rating'] ?? 5)));
    $quality = max(1, min(5, (int)($data['service_quality'] ?? $rating)));
    $behaviour = max(1, min(5, (int)($data['provider_behaviour'] ?? $rating)));
    $satisfaction = max(1, min(5, (int)($data['work_satisfaction'] ?? $rating)));
    $feedback = trim($data['written_feedback'] ?? '');

    $pdo->beginTransaction();
    try {
        $rStmt = $pdo->prepare("
            INSERT INTO customer_reviews (booking_id, user_id, provider_type, provider_id, rating, service_quality, provider_behaviour, work_satisfaction, written_feedback)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $rStmt->execute([
            $bookingId,
            $userId,
            $booking['assigned_provider_type'],
            $booking['assigned_provider_id'],
            $rating,
            $quality,
            $behaviour,
            $satisfaction,
            $feedback,
        ]);

        $pdo->prepare("UPDATE bookings SET customer_confirmed_completion = 1, status = 'Completed and Reviewed' WHERE id = ?")->execute([$bookingId]);
        recordBookingStatus($pdo, $bookingId, 'Completed and Reviewed', 'user', $userId, "Customer confirmed completion and rated {$rating}/5.");

        // Recalculate provider average rating
        $pTable = $booking['assigned_provider_type'] === 'electrician' ? 'electricians' : 'plumbers';
        $avgStmt = $pdo->prepare("SELECT AVG(rating) AS avg_r, COUNT(*) AS cnt FROM customer_reviews WHERE provider_type = ? AND provider_id = ?");
        $avgStmt->execute([$booking['assigned_provider_type'], $booking['assigned_provider_id']]);
        $avgRow = $avgStmt->fetch();
        $pdo->prepare("UPDATE {$pTable} SET average_rating = ?, total_reviews = ? WHERE id = ?")
            ->execute([round((float)$avgRow['avg_r'], 2), (int)$avgRow['cnt'], $booking['assigned_provider_id']]);

        createNotification($pdo, 'admin', null, 'new_review', 'New Customer Review', "Booking {$booking['booking_code']} rated {$rating}/5.", $bookingId);
        $pdo->commit();
        jsonResponse(['success' => true]);
    } catch (Throwable $e) {
        $pdo->rollBack();
        jsonResponse(['error' => 'Failed to submit review.'], 500);
    }
}

if ($action === 'vouchers') {
    $vStmt = $pdo->prepare("
        SELECT gv.*
        FROM gift_vouchers gv
        WHERE gv.is_active = 1
          AND gv.expiry_date >= CURDATE()
          AND (
            gv.target_audience = 'all_users'
            OR EXISTS (SELECT 1 FROM voucher_assignments va WHERE va.voucher_id = gv.id AND va.user_id = ?)
          )
        ORDER BY gv.expiry_date ASC
    ");
    $vStmt->execute([$userId]);
    $available = $vStmt->fetchAll();

    $rStmt = $pdo->prepare("
        SELECT vr.*, gv.voucher_code, gv.voucher_name, b.booking_code
        FROM voucher_redemptions vr
        JOIN gift_vouchers gv ON gv.id = vr.voucher_id
        JOIN bookings b ON b.id = vr.booking_id
        WHERE vr.user_id = ?
        ORDER BY vr.redeemed_at DESC
    ");
    $rStmt->execute([$userId]);
    $redemptions = $rStmt->fetchAll();

    jsonResponse(['available_vouchers' => $available, 'redemptions' => $redemptions]);
}

if ($action === 'validate_voucher') {
    $data = getJsonInput();
    $code = strtoupper(trim($data['voucher_code'] ?? ''));
    $baseAmount = (float)($data['amount'] ?? 0);
    $serviceId = isset($data['service_id']) ? (int)$data['service_id'] : null;

    if ($code === '' || $baseAmount <= 0) {
        jsonResponse(['error' => 'Voucher code and valid booking amount are required.'], 422);
    }

    $vStmt = $pdo->prepare("SELECT * FROM gift_vouchers WHERE UPPER(voucher_code) = ? LIMIT 1");
    $vStmt->execute([$code]);
    $voucher = $vStmt->fetch();

    if (!$voucher || (int)$voucher['is_active'] !== 1) {
        jsonResponse(['error' => 'Invalid or inactive voucher code.'], 422);
    }
    $today = date('Y-m-d');
    if ($today < $voucher['start_date'] || $today > $voucher['expiry_date']) {
        jsonResponse(['error' => 'This voucher has expired or is not yet active.'], 422);
    }
    if ($baseAmount < (float)$voucher['min_booking_amount']) {
        jsonResponse(['error' => 'Minimum booking amount of INR ' . $voucher['min_booking_amount'] . ' is required.'], 422);
    }
    if ($voucher['target_audience'] === 'specific_users') {
        $aStmt = $pdo->prepare("SELECT id FROM voucher_assignments WHERE voucher_id = ? AND user_id = ?");
        $aStmt->execute([$voucher['id'], $userId]);
        if (!$aStmt->fetch()) {
            jsonResponse(['error' => 'This voucher is not assigned to your account.'], 403);
        }
    }
    if ($voucher['applicable_scope'] === 'specific_services' && $serviceId) {
        $ids = array_filter(array_map('intval', explode(',', (string)$voucher['applicable_service_ids'])));
        if (!in_array($serviceId, $ids, true)) {
            jsonResponse(['error' => 'This voucher is not applicable to the selected service.'], 422);
        }
    }

    $totStmt = $pdo->prepare("SELECT COUNT(*) FROM voucher_redemptions WHERE voucher_id = ?");
    $totStmt->execute([$voucher['id']]);
    if ((int)$totStmt->fetchColumn() >= (int)$voucher['total_usage_limit']) {
        jsonResponse(['error' => 'Voucher total usage limit reached.'], 422);
    }

    $usrStmt = $pdo->prepare("SELECT COUNT(*) FROM voucher_redemptions WHERE voucher_id = ? AND user_id = ?");
    $usrStmt->execute([$voucher['id'], $userId]);
    if ((int)$usrStmt->fetchColumn() >= (int)$voucher['per_user_limit']) {
        jsonResponse(['error' => 'You have already reached the usage limit for this voucher.'], 422);
    }

    $discount = $voucher['discount_type'] === 'fixed'
        ? (float)$voucher['discount_value']
        : ($baseAmount * (float)$voucher['discount_value']) / 100.0;

    if ($voucher['discount_type'] === 'percentage' && $voucher['max_discount_amount'] !== null) {
        $discount = min($discount, (float)$voucher['max_discount_amount']);
    }
    $discount = round(min($discount, $baseAmount), 2);
    $finalAmount = max(1.00, round($baseAmount - $discount, 2));

    jsonResponse([
        'valid' => true,
        'voucher_id' => (int)$voucher['id'],
        'voucher_code' => $voucher['voucher_code'],
        'discount_amount' => $discount,
        'final_amount' => $finalAmount,
    ]);
}

jsonResponse(['error' => 'Unknown user action.'], 400);

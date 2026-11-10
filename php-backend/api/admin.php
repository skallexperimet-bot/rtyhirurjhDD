<?php
require_once __DIR__ . '/../helpers/auth.php';
require_once __DIR__ . '/../helpers/upload.php';
require_once __DIR__ . '/../helpers/razorpay.php';

$auth = requireAuth(['admin']);
$adminId = $auth['id'];
$action = $_GET['action'] ?? '';
$pdo = getDB();

if ($action === 'dashboard') {
    $users = $pdo->query("SELECT id, full_name, mobile_number, address, village_city, district, state, pin_code, status, created_at FROM users ORDER BY id DESC")->fetchAll();
    $electricians = $pdo->query("SELECT id, full_name, mobile_number, address, pin_code, qualification_details, experience_details, approval_status, rejection_reason, average_rating, total_reviews, created_at FROM electricians ORDER BY id DESC")->fetchAll();
    $plumbers = $pdo->query("SELECT id, full_name, mobile_number, address, pin_code, qualification_details, experience_details, approval_status, rejection_reason, average_rating, total_reviews, created_at FROM plumbers ORDER BY id DESC")->fetchAll();
    $docs = $pdo->query("SELECT * FROM provider_documents ORDER BY id DESC")->fetchAll();
    $bookings = $pdo->query("SELECT b.*, u.full_name AS customer_name, u.mobile_number AS customer_mobile FROM bookings b JOIN users u ON u.id = b.user_id ORDER BY b.id DESC")->fetchAll();
    $payments = $pdo->query("SELECT p.*, b.booking_code, u.full_name AS customer_name, u.mobile_number AS customer_mobile FROM payments p JOIN bookings b ON b.id = p.booking_id JOIN users u ON u.id = p.user_id ORDER BY p.id DESC")->fetchAll();
    $charges = $pdo->query("SELECT * FROM electrician_service_charges ORDER BY id DESC")->fetchAll();
    $payouts = $pdo->query("SELECT * FROM electrician_payouts ORDER BY id DESC")->fetchAll();
    $reviews = $pdo->query("
        SELECT r.*, b.booking_code, b.problem_description, b.service_address, b.created_at AS booking_date,
               u.full_name AS customer_name, u.mobile_number AS customer_mobile
        FROM customer_reviews r
        JOIN bookings b ON b.id = r.booking_id
        JOIN users u ON u.id = r.user_id
        ORDER BY r.id DESC
    ")->fetchAll();
    $notifications = $pdo->query("SELECT * FROM notifications WHERE recipient_role = 'admin' ORDER BY id DESC LIMIT 50")->fetchAll();
    $categories = $pdo->query("SELECT * FROM service_categories ORDER BY display_order ASC, id ASC")->fetchAll();
    $services = $pdo->query("SELECT * FROM services ORDER BY display_order ASC, id ASC")->fetchAll();
    $vouchers = $pdo->query("SELECT * FROM gift_vouchers ORDER BY id DESC")->fetchAll();
    $voucherRedemptions = $pdo->query("SELECT * FROM voucher_redemptions ORDER BY id DESC")->fetchAll();

    jsonResponse([
        'users' => $users,
        'electricians' => $electricians,
        'plumbers' => $plumbers,
        'documents' => $docs,
        'bookings' => $bookings,
        'payments' => $payments,
        'service_charges' => $charges,
        'payouts' => $payouts,
        'reviews' => $reviews,
        'notifications' => $notifications,
        'categories' => $categories,
        'services' => $services,
        'vouchers' => $vouchers,
        'voucher_redemptions' => $voucherRedemptions,
    ]);
}

if ($action === 'toggle_user_status') {
    $data = getJsonInput();
    $userId = (int)($data['user_id'] ?? 0);
    $status = ($data['status'] ?? 'active') === 'blocked' ? 'blocked' : 'active';
    $pdo->prepare("UPDATE users SET status = ? WHERE id = ?")->execute([$status, $userId]);
    jsonResponse(['success' => true]);
}

if ($action === 'update_provider_approval') {
    $data = getJsonInput();
    $type = $data['provider_type'] ?? '';
    $id = (int)($data['provider_id'] ?? 0);
    $status = $data['approval_status'] ?? '';
    $reason = trim($data['rejection_reason'] ?? '');

    if (!in_array($type, ['electrician', 'plumber'], true) || !in_array($status, ['approved', 'rejected', 'blocked', 'pending'], true)) {
        jsonResponse(['error' => 'Invalid provider approval parameters.'], 422);
    }

    $table = $type === 'electrician' ? 'electricians' : 'plumbers';
    $pdo->prepare("UPDATE {$table} SET approval_status = ?, rejection_reason = ? WHERE id = ?")
        ->execute([$status, $status === 'rejected' ? $reason : null, $id]);

    createNotification($pdo, $type, $id, 'approval_updated', 'Application ' . ucfirst($status), $reason ?: "Your account status is now {$status}.");
    jsonResponse(['success' => true]);
}

if ($action === 'verify_document') {
    $data = getJsonInput();
    $docId = (int)($data['document_id'] ?? 0);
    $status = in_array($data['verification_status'] ?? '', ['verified', 'rejected'], true) ? $data['verification_status'] : 'verified';
    $pdo->prepare("UPDATE provider_documents SET verification_status = ?, verified_by_admin_id = ?, verified_at = NOW() WHERE id = ?")
        ->execute([$status, $adminId, $docId]);
    jsonResponse(['success' => true]);
}

if ($action === 'assign_booking') {
    $data = getJsonInput();
    $bookingId = (int)($data['booking_id'] ?? 0);
    $providerType = $data['provider_type'] ?? '';
    $providerId = (int)($data['provider_id'] ?? 0);
    if (!in_array($providerType, ['electrician', 'plumber'], true) || !$bookingId || !$providerId) {
        jsonResponse(['error' => 'Invalid assignment parameters.'], 422);
    }

    $pdo->prepare("UPDATE bookings SET assigned_provider_type = ?, assigned_provider_id = ?, status = 'Waiting for Electrician' WHERE id = ?")
        ->execute([$providerType, $providerId, $bookingId]);
    recordBookingStatus($pdo, $bookingId, 'Waiting for Electrician', 'admin', $adminId, "Assigned to {$providerType} #{$providerId}.");
    createNotification($pdo, $providerType, $providerId, 'booking_assigned', 'New Job Assigned', "You have been assigned booking #{$bookingId}.", $bookingId);
    jsonResponse(['success' => true]);
}

if ($action === 'create_manual_booking') {
    $data = getJsonInput();
    $userId = (int)($data['user_id'] ?? 0);
    $category = $data['service_category'] ?? 'electrician';
    $amount = (float)($data['booking_amount'] ?? 299);
    $bookingCode = 'VV-' . strtoupper(substr($category, 0, 2)) . '-' . date('ymd') . '-' . random_int(1000, 9999);

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare("
            INSERT INTO bookings (booking_code, user_id, service_category, booking_method, problem_description, service_address, preferred_date, preferred_time, booking_amount, status, created_by_admin_id)
            VALUES (?, ?, ?, 'phone_manual', ?, ?, ?, ?, ?, 'Payment Pending', ?)
        ");
        $stmt->execute([
            $bookingCode,
            $userId,
            $category,
            trim($data['problem_description'] ?? ''),
            trim($data['service_address'] ?? ''),
            trim($data['preferred_date'] ?? date('Y-m-d')),
            trim($data['preferred_time'] ?? '10:00 AM'),
            $amount,
            $adminId,
        ]);
        $bookingId = (int)$pdo->lastInsertId();
        recordBookingStatus($pdo, $bookingId, 'Payment Pending', 'admin', $adminId, 'Manual phone-call booking created by Admin.');
        $pdo->commit();
        jsonResponse(['success' => true, 'booking_id' => $bookingId, 'booking_code' => $bookingCode], 201);
    } catch (Throwable $e) {
        $pdo->rollBack();
        jsonResponse(['error' => 'Failed to create manual booking.'], 500);
    }
}

if ($action === 'set_service_charge') {
    $data = getJsonInput();
    $bookingId = (int)($data['booking_id'] ?? 0);
    $providerType = $data['provider_type'] ?? '';
    $providerId = (int)($data['provider_id'] ?? 0);
    $charge = (float)($data['assigned_charge'] ?? 0);
    $notes = trim($data['notes'] ?? '');

    $stmt = $pdo->prepare("
        INSERT INTO electrician_service_charges (booking_id, provider_type, provider_id, assigned_charge, payout_status, assigned_by_admin_id, notes)
        VALUES (?, ?, ?, ?, 'pending', ?, ?)
        ON DUPLICATE KEY UPDATE assigned_charge = VALUES(assigned_charge), notes = VALUES(notes), assigned_by_admin_id = VALUES(assigned_by_admin_id)
    ");
    $stmt->execute([$bookingId, $providerType, $providerId, $charge, $adminId, $notes]);
    createNotification($pdo, 'admin', null, 'pending_payout', 'Pending Electrician Payment', "Service charge INR {$charge} assigned for booking #{$bookingId}.", $bookingId);
    jsonResponse(['success' => true]);
}

if ($action === 'record_payout') {
    $data = getJsonInput();
    $chargeId = (int)($data['service_charge_id'] ?? 0);
    $utr = trim($data['utr_reference'] ?? '');
    $mode = trim($data['payment_mode'] ?? 'UPI/Bank Transfer');
    $payDate = trim($data['payment_date'] ?? date('Y-m-d'));
    $remarks = trim($data['remarks'] ?? '');

    $cStmt = $pdo->prepare("SELECT * FROM electrician_service_charges WHERE id = ?");
    $cStmt->execute([$chargeId]);
    $charge = $cStmt->fetch();
    if (!$charge || $utr === '') {
        jsonResponse(['error' => 'Valid service charge and UTR reference are required.'], 422);
    }

    $pdo->beginTransaction();
    try {
        $pdo->prepare("
            INSERT INTO electrician_payouts (service_charge_id, booking_id, provider_type, provider_id, paid_amount, utr_reference, payment_mode, payment_date, paid_by_admin_id, remarks)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ")->execute([
            $chargeId,
            $charge['booking_id'],
            $charge['provider_type'],
            $charge['provider_id'],
            $charge['assigned_charge'],
            $utr,
            $mode,
            $payDate,
            $adminId,
            $remarks,
        ]);

        $pdo->prepare("UPDATE electrician_service_charges SET payout_status = 'paid' WHERE id = ?")->execute([$chargeId]);
        createNotification($pdo, $charge['provider_type'], (int)$charge['provider_id'], 'payout_received', 'Service Charge Paid', "INR {$charge['assigned_charge']} paid via {$mode} (UTR: {$utr}).", (int)$charge['booking_id']);
        $pdo->commit();
        jsonResponse(['success' => true]);
    } catch (Throwable $e) {
        $pdo->rollBack();
        jsonResponse(['error' => 'Failed to record manual payout.'], 500);
    }
}

if ($action === 'toggle_review_visibility') {
    $data = getJsonInput();
    $reviewId = (int)($data['review_id'] ?? 0);
    $isVisible = !empty($data['is_visible']) ? 1 : 0;
    $reason = trim($data['reason'] ?? '');
    $pdo->prepare("UPDATE customer_reviews SET is_visible = ? WHERE id = ?")->execute([$isVisible, $reviewId]);
    $pdo->prepare("INSERT INTO review_visibility_logs (review_id, admin_id, action, reason) VALUES (?, ?, ?, ?)")
        ->execute([$reviewId, $adminId, $isVisible ? 'unhidden' : 'hidden', $reason]);
    jsonResponse(['success' => true]);
}

if ($action === 'save_category') {
    $data = getJsonInput();
    $id = isset($data['id']) ? (int)$data['id'] : 0;
    $name = trim($data['name'] ?? '');
    $slug = strtolower(preg_replace('/[^a-z0-9]+/i', '_', $name));
    $isActive = isset($data['is_active']) ? (int)$data['is_active'] : 1;
    $order = (int)($data['display_order'] ?? 0);
    if ($name === '') {
        jsonResponse(['error' => 'Category name is required.'], 422);
    }
    if ($id > 0) {
        $pdo->prepare("UPDATE service_categories SET name = ?, is_active = ?, display_order = ? WHERE id = ?")
            ->execute([$name, $isActive, $order, $id]);
    } else {
        $pdo->prepare("INSERT INTO service_categories (slug, name, is_active, display_order) VALUES (?, ?, ?, ?)")
            ->execute([$slug, $name, $isActive, $order]);
    }
    jsonResponse(['success' => true]);
}

if ($action === 'save_service') {
    $id = isset($_POST['id']) ? (int)$_POST['id'] : 0;
    $categoryId = (int)($_POST['category_id'] ?? 0);
    $name = trim($_POST['service_name'] ?? '');
    $desc = trim($_POST['description'] ?? '');
    $price = (float)($_POST['price'] ?? 299);
    $pricingType = in_array($_POST['pricing_type'] ?? '', ['fixed', 'starting_at', 'hourly', 'custom_quote', 'inspection'], true) ? $_POST['pricing_type'] : 'fixed';
    $isAvailable = isset($_POST['is_available']) ? (int)$_POST['is_available'] : 1;
    $isActive = isset($_POST['is_active']) ? (int)$_POST['is_active'] : 1;
    $order = (int)($_POST['display_order'] ?? 0);

    $imagePath = null;
    if (!empty($_FILES['image']['name'])) {
        $up = handleSecureUpload($_FILES['image'], 'services', ALLOWED_IMAGE_MIMES);
        if (isset($up['error'])) {
            jsonResponse(['error' => $up['error']], 422);
        }
        $imagePath = $up['file_path'];
    }

    if ($id > 0) {
        if ($imagePath) {
            $pdo->prepare("UPDATE services SET category_id=?, service_name=?, description=?, image_path=?, price=?, pricing_type=?, is_available=?, is_active=?, display_order=? WHERE id=?")
                ->execute([$categoryId, $name, $desc, $imagePath, $price, $pricingType, $isAvailable, $isActive, $order, $id]);
        } else {
            $pdo->prepare("UPDATE services SET category_id=?, service_name=?, description=?, price=?, pricing_type=?, is_available=?, is_active=?, display_order=? WHERE id=?")
                ->execute([$categoryId, $name, $desc, $price, $pricingType, $isAvailable, $isActive, $order, $id]);
        }
    } else {
        $pdo->prepare("INSERT INTO services (category_id, service_name, description, image_path, price, pricing_type, is_available, is_active, display_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
            ->execute([$categoryId, $name, $desc, $imagePath, $price, $pricingType, $isAvailable, $isActive, $order]);
    }
    jsonResponse(['success' => true]);
}

if ($action === 'delete_service') {
    $data = getJsonInput();
    $serviceId = (int)($data['service_id'] ?? 0);
    $chk = $pdo->prepare("SELECT COUNT(*) FROM bookings WHERE service_id = ?");
    $chk->execute([$serviceId]);
    if ((int)$chk->fetchColumn() > 0) {
        jsonResponse(['error' => 'Cannot delete service with historical bookings. Disable it instead.'], 409);
    }
    $pdo->prepare("DELETE FROM services WHERE id = ?")->execute([$serviceId]);
    jsonResponse(['success' => true]);
}

if ($action === 'save_voucher') {
    $data = getJsonInput();
    $id = isset($data['id']) ? (int)$data['id'] : 0;
    $code = strtoupper(trim($data['voucher_code'] ?? ''));
    if ($code === '' || empty($data['voucher_name'])) {
        jsonResponse(['error' => 'Voucher name and code are required.'], 422);
    }
    $params = [
        trim($data['voucher_name']),
        $code,
        trim($data['description'] ?? ''),
        $data['discount_type'] === 'percentage' ? 'percentage' : 'fixed',
        (float)$data['discount_value'],
        (float)($data['min_booking_amount'] ?? 0),
        $data['max_discount_amount'] !== null && $data['max_discount_amount'] !== '' ? (float)$data['max_discount_amount'] : null,
        $data['start_date'],
        $data['expiry_date'],
        max(1, (int)($data['total_usage_limit'] ?? 100)),
        max(1, (int)($data['per_user_limit'] ?? 1)),
        $data['applicable_scope'] === 'specific_services' ? 'specific_services' : 'all_services',
        trim($data['applicable_service_ids'] ?? ''),
        $data['target_audience'] === 'specific_users' ? 'specific_users' : 'all_users',
        isset($data['is_active']) ? (int)$data['is_active'] : 1,
    ];
    if ($id > 0) {
        $params[] = $id;
        $pdo->prepare("UPDATE gift_vouchers SET voucher_name=?, voucher_code=?, description=?, discount_type=?, discount_value=?, min_booking_amount=?, max_discount_amount=?, start_date=?, expiry_date=?, total_usage_limit=?, per_user_limit=?, applicable_scope=?, applicable_service_ids=?, target_audience=?, is_active=? WHERE id=?")
            ->execute($params);
    } else {
        $params[] = $adminId;
        $pdo->prepare("INSERT INTO gift_vouchers (voucher_name, voucher_code, description, discount_type, discount_value, min_booking_amount, max_discount_amount, start_date, expiry_date, total_usage_limit, per_user_limit, applicable_scope, applicable_service_ids, target_audience, is_active, created_by_admin_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
            ->execute($params);
        $id = (int)$pdo->lastInsertId();
    }
    if (!empty($data['assigned_user_ids']) && is_array($data['assigned_user_ids'])) {
        $pdo->prepare("DELETE FROM voucher_assignments WHERE voucher_id = ?")->execute([$id]);
        $aStmt = $pdo->prepare("INSERT IGNORE INTO voucher_assignments (voucher_id, user_id) VALUES (?, ?)");
        foreach ($data['assigned_user_ids'] as $uid) {
            $aStmt->execute([$id, (int)$uid]);
        }
    }
    jsonResponse(['success' => true, 'voucher_id' => $id]);
}

if ($action === 'delete_voucher') {
    $data = getJsonInput();
    $vid = (int)($data['voucher_id'] ?? 0);
    $chk = $pdo->prepare("SELECT COUNT(*) FROM voucher_redemptions WHERE voucher_id = ?");
    $chk->execute([$vid]);
    if ((int)$chk->fetchColumn() > 0) {
        jsonResponse(['error' => 'Cannot delete a voucher that has already been redeemed. Deactivate it instead.'], 409);
    }
    $pdo->prepare("DELETE FROM gift_vouchers WHERE id = ?")->execute([$vid]);
    jsonResponse(['success' => true]);
}

if ($action === 'refund_payment') {
    $data = getJsonInput();
    $paymentId = (int)($data['payment_id'] ?? 0);
    $reason = trim($data['refund_reason'] ?? 'Refunded by Admin');
    $stmt = $pdo->prepare("SELECT * FROM payments WHERE id = ? AND payment_status = 'success'");
    $stmt->execute([$paymentId]);
    $p = $stmt->fetch();
    if (!$p) {
        jsonResponse(['error' => 'Only successful payments can be marked as refunded.'], 422);
    }
    $refundAmount = isset($data['refunded_amount']) ? min((float)$p['amount'], (float)$data['refunded_amount']) : (float)$p['amount'];
    $pdo->prepare("UPDATE payments SET payment_status = 'refunded', refunded_amount = ?, refund_reason = ?, refunded_at = NOW() WHERE id = ?")
        ->execute([$refundAmount, $reason, $paymentId]);
    createNotification($pdo, 'user', (int)$p['user_id'], 'payment_refunded', 'Payment Refunded', "INR {$refundAmount} refunded for booking #{$p['booking_id']}.", (int)$p['booking_id']);
    jsonResponse(['success' => true]);
}

if ($action === 'get_razorpay_test_settings') {
    $stmt = $pdo->prepare("SELECT test_key_id, test_key_secret_enc, is_configured, last_tested_at, last_test_status, last_test_message, updated_at FROM payment_gateway_settings WHERE gateway_name = 'razorpay' LIMIT 1");
    $stmt->execute();
    $row = $stmt->fetch();
    $plainSecret = ($row && !empty($row['test_key_secret_enc'])) ? decryptSecretValue($row['test_key_secret_enc']) : '';
    jsonResponse([
        'payment_mode' => 'test',
        'test_key_id' => $row['test_key_id'] ?? '',
        'has_secret' => $plainSecret !== '',
        'masked_secret' => $plainSecret !== '' ? maskSecretValue($plainSecret) : '',
        'is_configured' => $row ? ((int)$row['is_configured'] === 1) : false,
        'last_tested_at' => $row['last_tested_at'] ?? null,
        'last_test_status' => $row['last_test_status'] ?? null,
        'last_test_message' => $row['last_test_message'] ?? null,
        'updated_at' => $row['updated_at'] ?? null,
    ]);
}

if ($action === 'save_razorpay_test_settings') {
    $data = getJsonInput();
    $testKeyId = trim($data['test_key_id'] ?? '');
    $testKeySecret = trim($data['test_key_secret'] ?? '');

    if ($testKeyId === '' || strpos($testKeyId, 'rzp_test_') !== 0) {
        jsonResponse(['error' => 'Razorpay Test Key ID must start with rzp_test_.'], 422);
    }

    $stmt = $pdo->prepare("SELECT test_key_secret_enc FROM payment_gateway_settings WHERE gateway_name = 'razorpay' LIMIT 1");
    $stmt->execute();
    $existing = $stmt->fetch();

    if ($testKeySecret === '') {
        $existingPlain = ($existing && !empty($existing['test_key_secret_enc'])) ? decryptSecretValue($existing['test_key_secret_enc']) : '';
        if ($existingPlain === '') {
            jsonResponse(['error' => 'Razorpay Test Key Secret is required.'], 422);
        }
        $secretEnc = $existing['test_key_secret_enc'];
        $masked = maskSecretValue($existingPlain);
    } else {
        $secretEnc = encryptSecretValue($testKeySecret);
        $masked = maskSecretValue($testKeySecret);
    }

    $pdo->prepare("
        INSERT INTO payment_gateway_settings (gateway_name, payment_mode, test_key_id, test_key_secret_enc, is_configured, updated_by_admin_id)
        VALUES ('razorpay', 'test', ?, ?, 1, ?)
        ON DUPLICATE KEY UPDATE
            payment_mode = 'test',
            test_key_id = VALUES(test_key_id),
            test_key_secret_enc = VALUES(test_key_secret_enc),
            is_configured = 1,
            updated_by_admin_id = VALUES(updated_by_admin_id)
    ")->execute([$testKeyId, $secretEnc, $adminId]);

    jsonResponse([
        'success' => true,
        'test_key_id' => $testKeyId,
        'has_secret' => true,
        'masked_secret' => $masked,
        'is_configured' => true,
        'message' => 'Razorpay Test Mode credentials saved securely on the server.',
    ]);
}

if ($action === 'test_razorpay_connection') {
    $data = getJsonInput();
    $inputKeyId = trim($data['test_key_id'] ?? '');
    $inputKeySecret = trim($data['test_key_secret'] ?? '');

    $stmt = $pdo->prepare("SELECT test_key_id, test_key_secret_enc FROM payment_gateway_settings WHERE gateway_name = 'razorpay' LIMIT 1");
    $stmt->execute();
    $row = $stmt->fetch();

    $keyId = $inputKeyId !== '' ? $inputKeyId : ($row['test_key_id'] ?? '');
    $keySecret = $inputKeySecret !== '' ? $inputKeySecret : (($row && !empty($row['test_key_secret_enc'])) ? decryptSecretValue($row['test_key_secret_enc']) : '');

    if ($keyId === '' || $keySecret === '') {
        jsonResponse(['connected' => false, 'message' => 'Please save your Razorpay Test Key ID and Test Key Secret first.'], 422);
    }

    $res = testRazorpayConnection($keyId, $keySecret);
    $statusLabel = !empty($res['connected']) ? 'connected' : 'failed';

    $pdo->prepare("
        UPDATE payment_gateway_settings
        SET last_tested_at = NOW(), last_test_status = ?, last_test_message = ?
        WHERE gateway_name = 'razorpay'
    ")->execute([$statusLabel, substr($res['message'] ?? '', 0, 250)]);

    jsonResponse($res, !empty($res['connected']) ? 200 : 400);
}

jsonResponse(['error' => 'Unknown admin action.'], 400);

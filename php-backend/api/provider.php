<?php
require_once __DIR__ . '/../helpers/auth.php';
require_once __DIR__ . '/../helpers/upload.php';

$auth = requireAuth(['electrician', 'plumber']);
$providerId = $auth['id'];
$providerType = $auth['role'];
$table = $providerType === 'electrician' ? 'electricians' : 'plumbers';
$action = $_GET['action'] ?? '';
$pdo = getDB();

// Fetch fresh approval status from DB
$pStmt = $pdo->prepare("SELECT id, full_name, mobile_number, address, pin_code, qualification_details, experience_details, approval_status, rejection_reason, average_rating, total_reviews FROM {$table} WHERE id = ?");
$pStmt->execute([$providerId]);
$provider = $pStmt->fetch();

if ($action === 'dashboard') {
    if ($provider['approval_status'] !== 'approved') {
        jsonResponse([
            'provider' => $provider,
            'approved' => false,
            'bookings' => [],
            'charges' => [],
            'payouts' => [],
        ]);
    }

    $bStmt = $pdo->prepare("
        SELECT b.*, u.full_name AS customer_name, u.mobile_number AS customer_mobile
        FROM bookings b
        JOIN users u ON u.id = b.user_id
        WHERE b.assigned_provider_type = ? AND b.assigned_provider_id = ?
        ORDER BY b.id DESC
    ");
    $bStmt->execute([$providerType, $providerId]);
    $bookings = $bStmt->fetchAll();

    $cStmt = $pdo->prepare("SELECT * FROM electrician_service_charges WHERE provider_type = ? AND provider_id = ? ORDER BY id DESC");
    $cStmt->execute([$providerType, $providerId]);
    $charges = $cStmt->fetchAll();

    $payStmt = $pdo->prepare("SELECT * FROM electrician_payouts WHERE provider_type = ? AND provider_id = ? ORDER BY id DESC");
    $payStmt->execute([$providerType, $providerId]);
    $payouts = $payStmt->fetchAll();

    jsonResponse([
        'provider' => $provider,
        'approved' => true,
        'bookings' => $bookings,
        'charges' => $charges,
        'payouts' => $payouts,
    ]);
}

// Enforce Admin approval for all operational endpoints
if ($provider['approval_status'] !== 'approved') {
    jsonResponse(['error' => 'Your account is not approved to perform booking actions.'], 403);
}

if ($action === 'update_booking_status') {
    $data = getJsonInput();
    $bookingId = (int)($data['booking_id'] ?? 0);
    $nextStatus = $data['status'] ?? '';
    $allowed = ['Accepted', 'In Progress', 'Waiting for Electrician'];
    if (!in_array($nextStatus, $allowed, true)) {
        jsonResponse(['error' => 'Invalid status transition.'], 422);
    }

    $stmt = $pdo->prepare("SELECT * FROM bookings WHERE id = ? AND assigned_provider_type = ? AND assigned_provider_id = ?");
    $stmt->execute([$bookingId, $providerType, $providerId]);
    $booking = $stmt->fetch();
    if (!$booking) {
        jsonResponse(['error' => 'Booking not found or not assigned to you.'], 404);
    }

    if ($nextStatus === 'Waiting for Electrician') {
        // Provider rejected assignment
        $pdo->prepare("UPDATE bookings SET assigned_provider_type = NULL, assigned_provider_id = NULL, status = 'Waiting for Electrician' WHERE id = ?")
            ->execute([$bookingId]);
        recordBookingStatus($pdo, $bookingId, 'Waiting for Electrician', $providerType, $providerId, $data['remarks'] ?? 'Rejected by provider.');
        createNotification($pdo, 'admin', null, 'provider_rejected_job', 'Provider Rejected Booking', "Booking {$booking['booking_code']} needs reassignment.", $bookingId);
    } else {
        $pdo->prepare("UPDATE bookings SET status = ? WHERE id = ?")->execute([$nextStatus, $bookingId]);
        recordBookingStatus($pdo, $bookingId, $nextStatus, $providerType, $providerId, $data['remarks'] ?? '');
        createNotification($pdo, 'user', (int)$booking['user_id'], 'status_updated', "Booking {$nextStatus}", "Your booking {$booking['booking_code']} is now {$nextStatus}.", $bookingId);
    }

    jsonResponse(['success' => true]);
}

if ($action === 'submit_completion') {
    $bookingId = (int)($_POST['booking_id'] ?? 0);
    $desc = trim($_POST['completion_description'] ?? '');
    if (!$bookingId || $desc === '') {
        jsonResponse(['error' => 'Booking ID and completion description are required.'], 422);
    }

    $stmt = $pdo->prepare("SELECT * FROM bookings WHERE id = ? AND assigned_provider_type = ? AND assigned_provider_id = ?");
    $stmt->execute([$bookingId, $providerType, $providerId]);
    $booking = $stmt->fetch();
    if (!$booking) {
        jsonResponse(['error' => 'Booking not found.'], 404);
    }

    if (empty($_FILES['completion_photos']['name'][0])) {
        jsonResponse(['error' => 'At least one work completion photo is required.'], 422);
    }

    $pdo->beginTransaction();
    try {
        $count = count($_FILES['completion_photos']['name']);
        for ($i = 0; $i < $count; $i++) {
            $file = [
                'name' => $_FILES['completion_photos']['name'][$i],
                'type' => $_FILES['completion_photos']['type'][$i],
                'tmp_name' => $_FILES['completion_photos']['tmp_name'][$i],
                'error' => $_FILES['completion_photos']['error'][$i],
                'size' => $_FILES['completion_photos']['size'][$i],
            ];
            $uploaded = handleSecureUpload($file, 'completion_photos', ALLOWED_IMAGE_MIMES);
            if (isset($uploaded['error'])) {
                throw new RuntimeException($uploaded['error']);
            }
            $pdo->prepare("INSERT INTO work_completion_photos (booking_id, provider_type, provider_id, file_path, original_name) VALUES (?, ?, ?, ?, ?)")
                ->execute([$bookingId, $providerType, $providerId, $uploaded['file_path'], $uploaded['original_name']]);
        }

        $pdo->prepare("UPDATE bookings SET completion_description = ?, status = 'Customer Review Pending' WHERE id = ?")
            ->execute([$desc, $bookingId]);
        recordBookingStatus($pdo, $bookingId, 'Work Completed', $providerType, $providerId, $desc);
        recordBookingStatus($pdo, $bookingId, 'Customer Review Pending', 'system', null, 'Awaiting customer confirmation and review.');

        createNotification($pdo, 'user', (int)$booking['user_id'], 'work_completed', 'Work Completed', "Please inspect completion photos and submit your review for {$booking['booking_code']}.", $bookingId);
        createNotification($pdo, 'admin', null, 'work_completed', 'Work Completion Submitted', "Provider submitted completion for {$booking['booking_code']}.", $bookingId);

        $pdo->commit();
        jsonResponse(['success' => true]);
    } catch (Throwable $e) {
        $pdo->rollBack();
        jsonResponse(['error' => $e->getMessage()], 400);
    }
}

jsonResponse(['error' => 'Unknown provider action.'], 400);

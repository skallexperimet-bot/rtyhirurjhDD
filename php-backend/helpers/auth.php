<?php
require_once __DIR__ . '/../config/config.php';

/**
 * Server-side Role-Based Authorization Guards
 * Never rely on frontend route hiding.
 */
function requireAuth(array $allowedRoles): array {
    if (empty($_SESSION['auth_user']) || empty($_SESSION['auth_role'])) {
        jsonResponse(['error' => 'Authentication required.'], 401);
    }
    if (!in_array($_SESSION['auth_role'], $allowedRoles, true)) {
        jsonResponse(['error' => 'Forbidden: insufficient role permissions.'], 403);
    }
    return [
        'id' => (int)$_SESSION['auth_user']['id'],
        'role' => $_SESSION['auth_role'],
        'data' => $_SESSION['auth_user'],
    ];
}

function createNotification(PDO $pdo, string $role, ?int $recipientId, string $eventType, string $title, string $message, ?int $bookingId = null): void {
    $stmt = $pdo->prepare("
        INSERT INTO notifications (recipient_role, recipient_id, event_type, title, message, related_booking_id)
        VALUES (?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([$role, $recipientId, $eventType, $title, $message, $bookingId]);
}

function recordBookingStatus(PDO $pdo, int $bookingId, string $status, string $role, ?int $actorId, string $remarks = ''): void {
    $stmt = $pdo->prepare("
        INSERT INTO booking_status_history (booking_id, status, changed_by_role, changed_by_id, remarks)
        VALUES (?, ?, ?, ?, ?)
    ");
    $stmt->execute([$bookingId, $status, $role, $actorId, $remarks]);
}

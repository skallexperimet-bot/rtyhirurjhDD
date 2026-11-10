<?php
require_once __DIR__ . '/../config/config.php';

$action = $_GET['action'] ?? 'home_data';
$pdo = getDB();

if ($action === 'home_data') {
    // Active categories and active services
    $categories = $pdo->query("
        SELECT id, slug, name, display_order
        FROM service_categories
        WHERE is_active = 1
        ORDER BY display_order ASC, id ASC
    ")->fetchAll();

    $services = $pdo->query("
        SELECT s.*, c.slug AS category_slug, c.name AS category_name
        FROM services s
        JOIN service_categories c ON c.id = s.category_id
        WHERE s.is_active = 1 AND c.is_active = 1
        ORDER BY s.display_order ASC, s.id ASC
    ")->fetchAll();

    // Only genuine, visible reviews from completed bookings
    $reviews = $pdo->query("
        SELECT
            r.id,
            r.rating,
            r.service_quality,
            r.provider_behaviour,
            r.work_satisfaction,
            r.written_feedback,
            r.provider_type,
            r.created_at,
            u.full_name AS customer_name,
            u.profile_image AS customer_profile_image,
            b.service_category,
            b.service_name_snapshot
        FROM customer_reviews r
        JOIN bookings b ON b.id = r.booking_id
        JOIN users u ON u.id = r.user_id
        WHERE r.is_visible = 1
          AND b.status IN ('Work Completed', 'Completed and Reviewed')
        ORDER BY r.created_at DESC
    ")->fetchAll();

    $avgStmt = $pdo->query("
        SELECT AVG(r.rating) AS avg_rating, COUNT(*) AS total_reviews
        FROM customer_reviews r
        JOIN bookings b ON b.id = r.booking_id
        WHERE r.is_visible = 1
          AND b.status IN ('Work Completed', 'Completed and Reviewed')
    ");
    $stats = $avgStmt->fetch();

    jsonResponse([
        'categories' => $categories,
        'services' => $services,
        'reviews' => $reviews,
        'average_rating' => $stats && $stats['avg_rating'] ? round((float)$stats['avg_rating'], 2) : 0,
        'total_reviews' => $stats ? (int)$stats['total_reviews'] : 0,
    ]);
}

jsonResponse(['error' => 'Unknown public action.'], 400);

<?php
/**
 * Volt & Valve - Core Configuration (InfinityFree Compatible)
 * Keep all secret keys strictly on the server.
 * Never expose RAZORPAY_*_KEY_SECRET or RAZORPAY_WEBHOOK_SECRET to frontend JS/HTML or public APIs.
 */

// Database Configuration (Update with InfinityFree MySQL credentials)
define('DB_HOST', getenv('DB_HOST') ?: 'sql100.infinityfree.com');
define('DB_NAME', getenv('DB_NAME') ?: 'if0_xxxxxxxx_voltvalve');
define('DB_USER', getenv('DB_USER') ?: 'if0_xxxxxxxx');
define('DB_PASS', getenv('DB_PASS') ?: 'YOUR_MYSQL_PASSWORD');

// ============================================================================
// RAZORPAY API KEYS CONFIGURATION
// 1. Set RAZORPAY_PAYMENT_MODE to 'test' for Test Mode or 'live' for Live Mode.
// 2. Enter your Test keys in RAZORPAY_TEST_KEY_ID / RAZORPAY_TEST_KEY_SECRET.
// 3. Enter your Live keys in RAZORPAY_LIVE_KEY_ID / RAZORPAY_LIVE_KEY_SECRET.
// 4. Test and Live keys are strictly isolated and will NEVER be mixed.
// ============================================================================
define('RAZORPAY_PAYMENT_MODE', getenv('RAZORPAY_PAYMENT_MODE') ?: 'test'); // 'test' | 'live'

// Test Mode Credentials (rzp_test_...)
define('RAZORPAY_TEST_KEY_ID', getenv('RAZORPAY_TEST_KEY_ID') ?: 'rzp_test_REPLACE_WITH_TEST_KEY_ID');
define('RAZORPAY_TEST_KEY_SECRET', getenv('RAZORPAY_TEST_KEY_SECRET') ?: 'REPLACE_WITH_TEST_KEY_SECRET');

// Live Mode Credentials (rzp_live_...)
define('RAZORPAY_LIVE_KEY_ID', getenv('RAZORPAY_LIVE_KEY_ID') ?: 'rzp_live_REPLACE_WITH_LIVE_KEY_ID');
define('RAZORPAY_LIVE_KEY_SECRET', getenv('RAZORPAY_LIVE_KEY_SECRET') ?: 'REPLACE_WITH_LIVE_KEY_SECRET');

// Webhook Secret (Configure in Razorpay Dashboard -> Webhooks)
define('RAZORPAY_WEBHOOK_SECRET', getenv('RAZORPAY_WEBHOOK_SECRET') ?: 'REPLACE_WITH_WEBHOOK_SECRET');

// Server-side symmetric encryption key for stored gateway secrets (change to a unique 32+ char string on production)
define('APP_ENCRYPTION_KEY', getenv('APP_ENCRYPTION_KEY') ?: 'vv_infinityfree_server_secret_key_change_me');

function encryptSecretValue(string $plain): string {
    if ($plain === '') return '';
    if (function_exists('openssl_encrypt')) {
        $key = hash('sha256', APP_ENCRYPTION_KEY, true);
        $iv = random_bytes(16);
        $cipher = openssl_encrypt($plain, 'AES-256-CBC', $key, OPENSSL_RAW_DATA, $iv);
        if ($cipher !== false) {
            return 'enc:' . base64_encode($iv . $cipher);
        }
    }
    return 'b64:' . base64_encode($plain);
}

function decryptSecretValue(string $stored): string {
    if ($stored === '') return '';
    if (strpos($stored, 'enc:') === 0 && function_exists('openssl_decrypt')) {
        $raw = base64_decode(substr($stored, 4), true);
        if ($raw !== false && strlen($raw) > 16) {
            $key = hash('sha256', APP_ENCRYPTION_KEY, true);
            $iv = substr($raw, 0, 16);
            $cipher = substr($raw, 16);
            $plain = openssl_decrypt($cipher, 'AES-256-CBC', $key, OPENSSL_RAW_DATA, $iv);
            if ($plain !== false) return $plain;
        }
        return '';
    }
    if (strpos($stored, 'b64:') === 0) {
        return base64_decode(substr($stored, 4), true) ?: '';
    }
    return $stored;
}

function maskSecretValue(string $secret): string {
    $len = strlen($secret);
    if ($len === 0) return '';
    if ($len <= 4) return str_repeat('•', $len);
    return str_repeat('•', max(8, $len - 4)) . substr($secret, -4);
}

/**
 * Returns ONLY the active Razorpay credentials for the configured payment mode.
 * Reads Test Mode credentials saved by Admin from MySQL payment_gateway_settings first,
 * falling back to config.php constants. Strictly prevents mixing Test and Live keys.
 */
function getRazorpayConfig(): array {
    $mode = (strtolower(RAZORPAY_PAYMENT_MODE) === 'live') ? 'live' : 'test';
    if ($mode === 'live') {
        $keyId = RAZORPAY_LIVE_KEY_ID;
        $keySecret = RAZORPAY_LIVE_KEY_SECRET;
        $validPrefix = strpos($keyId, 'rzp_live_') === 0 && strpos($keyId, 'REPLACE_WITH') === false;
        $secretConfigured = $keySecret !== '' && strpos($keySecret, 'REPLACE_WITH') === false;
        return [
            'mode' => 'live',
            'key_id' => $keyId,
            'key_secret' => $keySecret,
            'is_configured' => $validPrefix && $secretConfigured,
        ];
    }

    // Test Mode: prefer Admin-saved MySQL settings if present and valid
    $keyId = RAZORPAY_TEST_KEY_ID;
    $keySecret = RAZORPAY_TEST_KEY_SECRET;
    try {
        $pdo = getDB();
        $stmt = $pdo->prepare("SELECT test_key_id, test_key_secret_enc, is_configured FROM payment_gateway_settings WHERE gateway_name = 'razorpay' LIMIT 1");
        $stmt->execute();
        $row = $stmt->fetch();
        if ($row && (int)$row['is_configured'] === 1 && !empty($row['test_key_id']) && !empty($row['test_key_secret_enc'])) {
            $dbSecret = decryptSecretValue($row['test_key_secret_enc']);
            if ($dbSecret !== '') {
                $keyId = $row['test_key_id'];
                $keySecret = $dbSecret;
            }
        }
    } catch (Throwable $e) {
        // Table may not exist yet before migration_v4.sql; fall back to config constants
    }

    $validPrefix = strpos($keyId, 'rzp_test_') === 0 && strpos($keyId, 'REPLACE_WITH') === false;
    $secretConfigured = $keySecret !== '' && strpos($keySecret, 'REPLACE_WITH') === false;

    return [
        'mode' => 'test',
        'key_id' => $keyId,
        'key_secret' => $keySecret,
        'is_configured' => $validPrefix && $secretConfigured,
    ];
}

$activeRzp = getRazorpayConfig();
define('RAZORPAY_KEY_ID', $activeRzp['key_id']);
define('RAZORPAY_KEY_SECRET', $activeRzp['key_secret']);

// SMS OTP Gateway Configuration (Configure when SMS provider is selected)
define('SMS_GATEWAY_ENABLED', false);
define('SMS_PROVIDER', 'msg91'); // e.g. msg91, fast2sms, twilio
define('SMS_API_KEY', getenv('SMS_API_KEY') ?: '');
define('SMS_SENDER_ID', 'VLTVLV');

// Upload Configuration
define('UPLOAD_BASE_DIR', __DIR__ . '/../../uploads/');
define('MAX_UPLOAD_SIZE_BYTES', 5 * 1024 * 1024); // 5 MB
define('ALLOWED_IMAGE_MIMES', ['image/jpeg', 'image/png', 'image/webp']);
define('ALLOWED_DOC_MIMES', ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

// Session Security
ini_set('session.cookie_httponly', 1);
ini_set('session.use_only_cookies', 1);
ini_set('session.cookie_samesite', 'Lax');
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

function getDB(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ];
        $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
    }
    return $pdo;
}

function jsonResponse(array $data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function getJsonInput(): array {
    $raw = file_get_contents('php://input');
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

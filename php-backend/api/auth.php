<?php
require_once __DIR__ . '/../helpers/auth.php';
require_once __DIR__ . '/../helpers/otp.php';
require_once __DIR__ . '/../helpers/upload.php';

$action = $_GET['action'] ?? '';
$pdo = getDB();

if ($action === 'session') {
    if (empty($_SESSION['auth_user']) || empty($_SESSION['auth_role'])) {
        jsonResponse(['authenticated' => false]);
    }
    jsonResponse([
        'authenticated' => true,
        'role' => $_SESSION['auth_role'],
        'user' => $_SESSION['auth_user'],
    ]);
}

if ($action === 'logout') {
    session_destroy();
    jsonResponse(['success' => true]);
}

if ($action === 'send_otp') {
    $data = getJsonInput();
    $mobile = trim($data['mobile_number'] ?? '');
    $role = trim($data['role'] ?? 'user');
    if (!preg_match('/^[0-9]{10,15}$/', $mobile) || !in_array($role, ['user', 'electrician', 'plumber'], true)) {
        jsonResponse(['error' => 'Invalid mobile number or role.'], 422);
    }
    $res = generateAndSendOtp($pdo, $mobile, $role, $data['purpose'] ?? 'registration');
    jsonResponse($res);
}

if ($action === 'user_register') {
    $data = getJsonInput();
    $required = ['full_name', 'mobile_number', 'password', 'address', 'village_city', 'district', 'state', 'pin_code', 'otp_code'];
    foreach ($required as $f) {
        if (empty(trim((string)($data[$f] ?? '')))) {
            jsonResponse(['error' => "Field {$f} is required."], 422);
        }
    }

    if (!verifyOtpCode($pdo, trim($data['mobile_number']), 'user', trim($data['otp_code']))) {
        jsonResponse(['error' => 'Invalid or expired OTP.'], 422);
    }

    $hash = password_hash($data['password'], PASSWORD_BCRYPT);
    $stmt = $pdo->prepare("
        INSERT INTO users (full_name, mobile_number, password_hash, address, village_city, district, state, pin_code, is_otp_verified)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    ");
    try {
        $stmt->execute([
            trim($data['full_name']),
            trim($data['mobile_number']),
            $hash,
            trim($data['address']),
            trim($data['village_city']),
            trim($data['district']),
            trim($data['state']),
            trim($data['pin_code']),
        ]);
    } catch (PDOException $e) {
        jsonResponse(['error' => 'Mobile number is already registered.'], 409);
    }

    $userId = (int)$pdo->lastInsertId();
    createNotification($pdo, 'admin', null, 'new_user', 'New User Registered', trim($data['full_name']) . ' registered from ' . trim($data['village_city']));

    $userStmt = $pdo->prepare("SELECT id, full_name, mobile_number, address, village_city, district, state, pin_code, status FROM users WHERE id = ?");
    $userStmt->execute([$userId]);
    $user = $userStmt->fetch();

    $_SESSION['auth_role'] = 'user';
    $_SESSION['auth_user'] = $user;
    jsonResponse(['success' => true, 'user' => $user, 'role' => 'user'], 201);
}

if ($action === 'user_login') {
    $data = getJsonInput();
    $mobile = trim($data['mobile_number'] ?? '');
    $password = $data['password'] ?? '';
    $stmt = $pdo->prepare("SELECT * FROM users WHERE mobile_number = ?");
    $stmt->execute([$mobile]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        jsonResponse(['error' => 'Invalid mobile number or password.'], 401);
    }
    if ($user['status'] === 'blocked') {
        jsonResponse(['error' => 'Your account has been blocked by the administrator.'], 403);
    }
    if ((int)$user['is_otp_verified'] !== 1) {
        jsonResponse(['error' => 'Mobile OTP verification is pending.'], 403);
    }

    unset($user['password_hash']);
    $_SESSION['auth_role'] = 'user';
    $_SESSION['auth_user'] = $user;
    jsonResponse(['success' => true, 'user' => $user, 'role' => 'user']);
}

if ($action === 'provider_register') {
    $category = $_POST['service_category'] ?? '';
    if (!in_array($category, ['electrician', 'plumber'], true)) {
        jsonResponse(['error' => 'Service category must be electrician or plumber.'], 422);
    }
    $required = ['full_name', 'mobile_number', 'password', 'address', 'pin_code', 'qualification_details', 'experience_details', 'otp_code'];
    foreach ($required as $f) {
        if (empty(trim((string)($_POST[$f] ?? '')))) {
            jsonResponse(['error' => "Field {$f} is required."], 422);
        }
    }

    if (!verifyOtpCode($pdo, trim($_POST['mobile_number']), $category, trim($_POST['otp_code']))) {
        jsonResponse(['error' => 'Invalid or expired OTP.'], 422);
    }

    if (empty($_FILES['experience_certificate']) || empty($_FILES['police_verification'])) {
        jsonResponse(['error' => 'Experience Certificate and Police Verification Certificate are mandatory.'], 422);
    }

    $table = $category === 'electrician' ? 'electricians' : 'plumbers';
    $hash = password_hash($_POST['password'], PASSWORD_BCRYPT);

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare("
            INSERT INTO {$table} (full_name, mobile_number, password_hash, address, pin_code, qualification_details, experience_details, is_otp_verified, approval_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'pending')
        ");
        $stmt->execute([
            trim($_POST['full_name']),
            trim($_POST['mobile_number']),
            $hash,
            trim($_POST['address']),
            trim($_POST['pin_code']),
            trim($_POST['qualification_details']),
            trim($_POST['experience_details']),
        ]);
        $providerId = (int)$pdo->lastInsertId();

        $docFields = [
            'qualification_certificate' => $_FILES['qualification_certificate'] ?? null,
            'experience_certificate' => $_FILES['experience_certificate'],
            'police_verification' => $_FILES['police_verification'],
        ];
        foreach ($docFields as $docType => $file) {
            if ($file && $file['error'] !== UPLOAD_ERR_NO_FILE) {
                $uploaded = handleSecureUpload($file, 'provider_docs', ALLOWED_DOC_MIMES);
                if (isset($uploaded['error'])) {
                    throw new RuntimeException($uploaded['error']);
                }
                $dStmt = $pdo->prepare("
                    INSERT INTO provider_documents (provider_type, provider_id, document_type, file_path, original_name)
                    VALUES (?, ?, ?, ?, ?)
                ");
                $dStmt->execute([$category, $providerId, $docType, $uploaded['file_path'], $uploaded['original_name']]);
            }
        }

        createNotification(
            $pdo,
            'admin',
            null,
            'new_' . $category . '_application',
            'New ' . ucfirst($category) . ' Application',
            trim($_POST['full_name']) . ' submitted documents for verification.'
        );
        $pdo->commit();
        jsonResponse(['success' => true, 'message' => 'Application submitted for Admin approval.'], 201);
    } catch (Throwable $e) {
        $pdo->rollBack();
        jsonResponse(['error' => $e->getMessage()], 400);
    }
}

if ($action === 'provider_login') {
    $data = getJsonInput();
    $category = $data['service_category'] ?? '';
    $mobile = trim($data['mobile_number'] ?? '');
    $password = $data['password'] ?? '';

    if (!in_array($category, ['electrician', 'plumber'], true)) {
        jsonResponse(['error' => 'Invalid service category.'], 422);
    }
    $table = $category === 'electrician' ? 'electricians' : 'plumbers';
    $stmt = $pdo->prepare("SELECT * FROM {$table} WHERE mobile_number = ?");
    $stmt->execute([$mobile]);
    $provider = $stmt->fetch();

    if (!$provider || !password_verify($password, $provider['password_hash'])) {
        jsonResponse(['error' => 'Invalid credentials.'], 401);
    }
    unset($provider['password_hash']);
    $provider['service_category'] = $category;

    $_SESSION['auth_role'] = $category;
    $_SESSION['auth_user'] = $provider;
    jsonResponse(['success' => true, 'user' => $provider, 'role' => $category]);
}

if ($action === 'admin_login') {
    $data = getJsonInput();
    $email = trim($data['email'] ?? '');
    $password = $data['password'] ?? '';
    $stmt = $pdo->prepare("SELECT * FROM admin_users WHERE email = ? AND is_active = 1");
    $stmt->execute([$email]);
    $admin = $stmt->fetch();

    if (!$admin || !password_verify($password, $admin['password_hash'])) {
        jsonResponse(['error' => 'Invalid administrator credentials.'], 401);
    }

    $pdo->prepare("UPDATE admin_users SET last_login_at = NOW() WHERE id = ?")->execute([$admin['id']]);
    unset($admin['password_hash']);
    $_SESSION['auth_role'] = 'admin';
    $_SESSION['auth_user'] = $admin;
    jsonResponse(['success' => true, 'user' => $admin, 'role' => 'admin']);
}

jsonResponse(['error' => 'Unknown auth action.'], 400);

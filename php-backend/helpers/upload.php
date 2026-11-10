<?php
require_once __DIR__ . '/../config/config.php';

/**
 * Validates file MIME type, extension, and size, then moves to safe upload directory.
 */
function handleSecureUpload(array $file, string $subFolder, array $allowedMimes): array {
    if ($file['error'] !== UPLOAD_ERR_OK) {
        return ['error' => 'Upload failed with code ' . $file['error']];
    }
    if ($file['size'] > MAX_UPLOAD_SIZE_BYTES) {
        return ['error' => 'File exceeds maximum 5MB size limit.'];
    }

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->file($file['tmp_name']);
    if (!in_array($mime, $allowedMimes, true)) {
        return ['error' => 'Invalid file type: ' . $mime];
    }

    $extMap = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        'application/pdf' => 'pdf',
    ];
    $ext = $extMap[$mime] ?? 'bin';
    $safeDir = rtrim(UPLOAD_BASE_DIR, '/') . '/' . trim($subFolder, '/');
    if (!is_dir($safeDir)) {
        mkdir($safeDir, 0755, true);
    }

    $filename = bin2hex(random_bytes(16)) . '.' . $ext;
    $targetPath = $safeDir . '/' . $filename;
    if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
        return ['error' => 'Failed to save uploaded file.'];
    }

    return [
        'file_path' => 'uploads/' . trim($subFolder, '/') . '/' . $filename,
        'original_name' => basename($file['name']),
    ];
}

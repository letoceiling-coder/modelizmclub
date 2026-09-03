<?php
/**
 * Streams one backup file to the app's configured `s3` disk.
 *
 * Bootstraps the Laravel app so the credentials, endpoint and bucket come from
 * the same config the application uses — nothing about S3 is duplicated here.
 * Streamed rather than read into memory: dumps outgrow PHP's memory_limit.
 *
 * usage: php backup-db-upload.php <local-file> <remote-key>
 */

$src = $argv[1] ?? null;
$key = $argv[2] ?? null;

if ($src === null || $key === null) {
    fwrite(STDERR, "usage: backup-db-upload.php <local-file> <remote-key>\n");
    exit(2);
}

$appDir = getenv('APP_DIR') ?: '/var/www/modelizmclub';
$base = $appDir . '/backend';

if (! is_file($base . '/vendor/autoload.php')) {
    fwrite(STDERR, "upload: {$base}/vendor/autoload.php missing — run composer install\n");
    exit(1);
}

require $base . '/vendor/autoload.php';
$app = require $base . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

if (! is_readable($src)) {
    fwrite(STDERR, "upload: cannot read {$src}\n");
    exit(1);
}

$disk = config('filesystems.disks.s3.bucket');
if (empty($disk)) {
    fwrite(STDERR, "upload: AWS_BUCKET is not configured\n");
    exit(1);
}

$stream = fopen($src, 'rb');
if ($stream === false) {
    fwrite(STDERR, "upload: fopen failed for {$src}\n");
    exit(1);
}

try {
    // `throw => false` on the disk means a failed write returns false instead of
    // raising, so the return value has to be checked explicitly.
    $ok = Illuminate\Support\Facades\Storage::disk('s3')->writeStream($key, $stream);
} catch (\Throwable $e) {
    fwrite(STDERR, 'upload: ' . $e->getMessage() . "\n");
    exit(1);
} finally {
    if (is_resource($stream)) {
        fclose($stream);
    }
}

if ($ok !== true) {
    fwrite(STDERR, "upload: S3 write returned false for {$key}\n");
    exit(1);
}

fwrite(STDOUT, "upload: ok s3://{$disk}/{$key}\n");

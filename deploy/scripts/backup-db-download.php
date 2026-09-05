<?php
/**
 * Достаёт бэкап из S3 — обратная сторона backup-db-upload.php.
 *
 * Выгрузка в S3 была с самого начала, скачивания не было ни в каком виде:
 * восстановление подразумевало, что нужный дамп лежит на том же сервере. Но
 * авария, ради которой существуют бэкапы, обычно и означает, что диска этого
 * сервера больше нет. Проверка 05.09 упёрлась ровно в это.
 *
 *   php backup-db-download.php --list [префикс]     показать, что лежит в S3
 *   php backup-db-download.php <ключ> <куда>        скачать один файл
 *   php backup-db-download.php --latest daily <куда>  скачать свежайший в папке
 *
 * Учётные данные, endpoint и бакет берутся из конфигурации приложения — как и
 * при выгрузке, ничего про S3 здесь не дублируется.
 */

$appDir = getenv('APP_DIR') ?: '/var/www/modelizmclub';
$base = $appDir.'/backend';

if (! is_file($base.'/vendor/autoload.php')) {
    fwrite(STDERR, "download: {$base}/vendor/autoload.php missing — run composer install\n");
    exit(1);
}

require $base.'/vendor/autoload.php';
$app = require $base.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\Storage;

$prefix = getenv('BACKUP_S3_PREFIX') ?: 'backups';
$disk = Storage::disk('s3');

$args = array_slice($argv, 1);
$mode = $args[0] ?? null;

/** @return array<int, array{key: string, size: int, at: int}> */
$listing = function (string $dir) use ($disk): array {
    $rows = [];
    foreach ($disk->files($dir) as $key) {
        $rows[] = [
            'key' => $key,
            'size' => (int) $disk->size($key),
            'at' => (int) $disk->lastModified($key),
        ];
    }
    usort($rows, fn ($a, $b) => $b['at'] <=> $a['at']);

    return $rows;
};

if ($mode === '--list') {
    $dir = rtrim($prefix.'/'.($args[1] ?? ''), '/');
    $rows = $listing($dir);
    if ($rows === []) {
        fwrite(STDERR, "download: в {$dir} ничего нет\n");
        exit(1);
    }
    foreach ($rows as $row) {
        printf(
            "%s  %8s  %s\n",
            date('Y-m-d H:i', $row['at']),
            $row['size'] > 1048576 ? round($row['size'] / 1048576, 1).'M' : round($row['size'] / 1024).'K',
            $row['key'],
        );
    }
    exit(0);
}

if ($mode === '--latest') {
    $dir = rtrim($prefix.'/'.($args[1] ?? 'daily'), '/');
    $dest = $args[2] ?? null;
    if ($dest === null) {
        fwrite(STDERR, "usage: backup-db-download.php --latest <папка> <куда>\n");
        exit(2);
    }
    $rows = $listing($dir);
    if ($rows === []) {
        fwrite(STDERR, "download: в {$dir} ничего нет\n");
        exit(1);
    }
    $key = $rows[0]['key'];
} else {
    $key = $mode;
    $dest = $args[1] ?? null;
    if ($key === null || $dest === null) {
        fwrite(STDERR, "usage: backup-db-download.php <ключ> <куда> | --latest <папка> <куда> | --list [папка]\n");
        exit(2);
    }
}

if (! $disk->exists($key)) {
    fwrite(STDERR, "download: в S3 нет ключа {$key}\n");
    exit(1);
}

$stream = $disk->readStream($key);
if ($stream === null) {
    fwrite(STDERR, "download: не удалось открыть поток {$key}\n");
    exit(1);
}

// Потоком, а не в память: дампы перерастают memory_limit так же, как и при выгрузке.
$out = fopen($dest, 'wb');
if ($out === false) {
    fwrite(STDERR, "download: не удалось открыть на запись {$dest}\n");
    exit(1);
}
$bytes = stream_copy_to_stream($stream, $out);
fclose($out);
fclose($stream);

$expected = (int) $disk->size($key);
if ($bytes !== $expected) {
    fwrite(STDERR, "download: скачано {$bytes} байт вместо {$expected} — файл неполный\n");
    @unlink($dest);
    exit(1);
}

printf("download: %s -> %s (%s)\n", $key, $dest, $bytes > 1048576 ? round($bytes / 1048576, 1).'M' : round($bytes / 1024).'K');

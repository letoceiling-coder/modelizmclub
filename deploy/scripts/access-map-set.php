<?php

/*
 * Меняет уровень доступа одного или нескольких действий в сохранённой карте.
 *
 *   php deploy/scripts/access-map-set.php route.communities=guest
 *   php deploy/scripts/access-map-set.php --dry-run route.communities=guest layout.nav.communities=guest
 *
 * Карта правится из /admin, и это остаётся основным путём. Скрипт нужен там,
 * где админки нет под рукой: сервер, скрипт выкатки, разбор аварии. Он
 * трогает ровно указанные ключи — всё остальное в строке остаётся байт в
 * байт, включая тексты окна и deny_mode, — печатает «было → стало» и
 * отказывается работать, если ключа нет в реестре или уровень неизвестен.
 *
 * Уровни: guest | auth | subscription.
 */

$backend = getenv('BACKEND_DIR')
    ?: (is_file(getcwd().'/vendor/autoload.php') ? getcwd() : __DIR__.'/../../backend');

if (! is_file($backend.'/vendor/autoload.php')) {
    fwrite(STDERR, "access-map-set: no Laravel app at {$backend} — set BACKEND_DIR\n");
    exit(2);
}

require $backend.'/vendor/autoload.php';

$app = require $backend.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\SystemSetting;
use App\Support\FeedGuestAccessRegistry as Registry;

const TIERS = ['guest', 'auth', 'subscription'];

$args = array_slice($argv, 1);
$dryRun = false;
$pairs = [];

foreach ($args as $arg) {
    if ($arg === '--dry-run') {
        $dryRun = true;
        continue;
    }
    if (! str_contains($arg, '=')) {
        fwrite(STDERR, "access-map-set: ожидается key=tier, получено «{$arg}»\n");
        exit(2);
    }
    [$key, $tier] = explode('=', $arg, 2);
    $pairs[trim($key)] = trim($tier);
}

if ($pairs === []) {
    fwrite(STDERR, "access-map-set: нечего менять\n");
    fwrite(STDERR, "  php access-map-set.php [--dry-run] key=tier [key=tier …]\n");
    exit(2);
}

$known = [];
foreach (Registry::actions() as $row) {
    $known[$row['key']] = $row['label'];
}

foreach ($pairs as $key => $tier) {
    if (! isset($known[$key])) {
        fwrite(STDERR, "access-map-set: ключа «{$key}» нет в реестре\n");
        exit(2);
    }
    if (! in_array($tier, TIERS, true)) {
        fwrite(STDERR, "access-map-set: уровень «{$tier}» неизвестен, ожидается ".implode('|', TIERS)."\n");
        exit(2);
    }
}

$row = SystemSetting::query()->where('key', Registry::SETTING_KEY)->first();
$stored = is_array($row?->value) ? $row->value : [];
$original = $stored;
$before_values = [];

// Строка могла не содержать ключа вовсе: он добавлен в реестр после
// последнего сохранения из /admin и до сих пор действовал по умолчанию.
$defaults = Registry::defaultConfig()['actions'];
$changed = 0;

foreach ($pairs as $key => $tier) {
    $current = $stored['actions'][$key] ?? $defaults[$key];
    $before = $current['min_tier'] ?? $defaults[$key]['min_tier'];
    if ($before === $tier) {
        printf("  %-34s уже %s\n", $key, $tier);
        continue;
    }
    $before_values[$key] = ['from' => $before, 'to' => $tier, 'label' => $known[$key]];
    $current['min_tier'] = $tier;
    $stored['actions'][$key] = $current;
    $changed++;
    printf("  %-34s %-12s -> %-12s (%s)\n", $key, $before, $tier, $known[$key]);
}

if ($changed === 0) {
    echo "access-map-set: менять нечего\n";
    exit(0);
}

if ($dryRun) {
    echo "access-map-set: --dry-run, строка не тронута ({$changed} изменени(е/я) готовы)\n";
    exit(0);
}

// Снимок прежней строки — до записи и всегда. Карта решает, кто что видит;
// вернуть её к предыдущему состоянию нужно уметь, не восстанавливая дамп базы
// целиком. Снимок — та же строка, что лежала в system_settings, плюс список
// изменённых ключей со старыми значениями.
$snapshotDir = getenv('ACCESS_MAP_SNAPSHOT_DIR') ?: (is_dir('/root/backups') ? '/root/backups/access-map' : sys_get_temp_dir());
if (! is_dir($snapshotDir)) {
    @mkdir($snapshotDir, 0700, true);
}
$snapshotPath = rtrim($snapshotDir, '/').'/access-map-'.date('Ymd\THis').'.json';
$snapshot = [
    'taken_at' => date('c'),
    'changed' => $before_values,
    'previous_row' => $original,
];
if (@file_put_contents($snapshotPath, json_encode($snapshot, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)) === false) {
    fwrite(STDERR, "access-map-set: не удалось записать снимок в {$snapshotPath} — правка отменена\n");
    exit(2);
}
echo "access-map-set: снимок прежних значений — {$snapshotPath}\n";

SystemSetting::query()->updateOrCreate(
    ['key' => Registry::SETTING_KEY],
    ['value' => $stored, 'group' => 'feed'],
);

echo "access-map-set: сохранено, изменений — {$changed}\n";

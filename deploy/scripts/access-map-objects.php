<?php

/*
 * Prints the difference between the access map stored in the database and the
 * defaults declared in FeedGuestAccessRegistry, one finding per line.
 *
 * Machine-readable on purpose: access-map-drift.sh formats the output and
 * decides the exit code, the same split schema-drift.sh uses for the schema.
 *
 *   OVERRIDE|key|label|default_tier|stored_tier|default_deny|stored_deny
 *   EXTRA|key|stored_tier      key in the database, unknown to the registry
 *   MISSING|key|default_tier   key in the registry, absent from the database
 *   META|field|default|stored  top-level field (default_deny_mode, popup texts)
 *   TOTAL|n                    actions compared
 */

// The wrapper runs this from inside backend/ and passes BACKEND_DIR; the
// fallbacks keep it usable by hand, from a checkout or from a copy in /tmp.
$backend = getenv('BACKEND_DIR')
    ?: (is_file(getcwd().'/vendor/autoload.php') ? getcwd() : __DIR__.'/../../backend');

if (! is_file($backend.'/vendor/autoload.php')) {
    fwrite(STDERR, "access-map: no Laravel app at {$backend} — set BACKEND_DIR\n");
    exit(2);
}

require $backend.'/vendor/autoload.php';

$app = require $backend.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Support\FeedGuestAccessRegistry as Registry;
use Illuminate\Support\Facades\DB;

$reference = Registry::defaultConfig();

// The effective map, not the raw row. FeedGuestAccessService::mergedConfig()
// walks the registry on every read and fills anything the saved snapshot does
// not carry, so a key added to the registry after the last save is already
// served with its default. Comparing the raw row instead reports those as
// «missing» — which is what this script did on its first run, and it was
// wrong: production serves all 56 actions while the row holds 51.
$stored = app(Modules\PublicContent\Services\FeedGuestAccessService::class)->publicPayload();

// The stale row is worth one line, but as a note: it changes nothing until
// someone opens /admin, and then it fixes itself.
$raw = DB::table('system_settings')->where('key', Registry::SETTING_KEY)->value('value');
$rawActions = is_string($raw) ? (json_decode($raw, true)['actions'] ?? []) : [];
$notSaved = array_diff(array_keys($reference['actions']), array_keys($rawActions));

$labels = [];
foreach (Registry::actions() as $row) {
    $labels[$row['key']] = $row['label'];
}

$refActions = $reference['actions'] ?? [];
$curActions = $stored['actions'] ?? [];

$out = [];

foreach ($refActions as $key => $want) {
    $have = $curActions[$key] ?? $want;
    $wantTier = $want['min_tier'];
    $haveTier = $have['min_tier'] ?? $wantTier;
    $wantDeny = $want['deny_mode'];
    $haveDeny = $have['deny_mode'] ?? $wantDeny;

    if ($wantTier !== $haveTier || $wantDeny !== $haveDeny) {
        $out[] = sprintf(
            'OVERRIDE|%s|%s|%s|%s|%s|%s',
            $key,
            $labels[$key] ?? $key,
            $wantTier,
            $haveTier,
            $wantDeny,
            $haveDeny,
        );
    }
}

foreach ($curActions as $key => $have) {
    if (! array_key_exists($key, $refActions)) {
        $out[] = sprintf('EXTRA|%s|%s', $key, $have['min_tier'] ?? '?');
    }
}

foreach ($notSaved as $key) {
    $out[] = sprintf('NOTSAVED|%s|%s', $key, $refActions[$key]['min_tier'] ?? '?');
}

foreach (['version', 'default_deny_mode'] as $field) {
    $want = $reference[$field] ?? null;
    $have = $stored[$field] ?? null;
    if ($want !== $have) {
        $out[] = sprintf('META|%s|%s|%s', $field, var_export($want, true), var_export($have, true));
    }
}

foreach (($reference['popup'] ?? []) as $field => $want) {
    $have = $stored['popup'][$field] ?? null;
    if ($want !== $have) {
        $out[] = sprintf('META|popup.%s|%s|%s', $field, (string) $want, (string) $have);
    }
}

sort($out);
foreach ($out as $line) {
    fwrite(STDOUT, $line."\n");
}
fwrite(STDOUT, 'TOTAL|'.count($refActions)."\n");

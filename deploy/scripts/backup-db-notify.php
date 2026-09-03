<?php
/**
 * Sends one plain-text alert through the app's configured mailer.
 * Body arrives on stdin.  usage: ... | php backup-db-notify.php <to> <subject>
 *
 * Kept separate from the shell script because the VPS has no MTA — the only
 * working delivery path is the SMTP account Laravel already holds.
 */

$to = $argv[1] ?? null;
$subject = $argv[2] ?? 'ModelizmClub backup alert';
$body = stream_get_contents(STDIN) ?: 'Backup failed (no detail captured).';

if ($to === null) {
    fwrite(STDERR, "usage: backup-db-notify.php <to> <subject>\n");
    exit(2);
}

$base = (getenv('APP_DIR') ?: '/var/www/modelizmclub') . '/backend';
if (! is_file($base . '/vendor/autoload.php')) {
    fwrite(STDERR, "notify: {$base}/vendor/autoload.php missing\n");
    exit(1);
}

require $base . '/vendor/autoload.php';
$app = require $base . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

try {
    Illuminate\Support\Facades\Mail::raw($body, function ($m) use ($to, $subject) {
        $m->to($to)->subject($subject);
    });
} catch (\Throwable $e) {
    fwrite(STDERR, 'notify: ' . $e->getMessage() . "\n");
    exit(1);
}

fwrite(STDOUT, "notify: sent to {$to}\n");

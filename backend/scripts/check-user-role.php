<?php

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$email = $argv[1] ?? '';
if ($email === '') {
    fwrite(STDERR, "Usage: php scripts/check-user-role.php user@example.com\n");
    exit(1);
}

$user = App\Models\User::query()->where('email', $email)->first();
if (! $user) {
    echo "NOT_FOUND\n";
    exit(0);
}

echo "id={$user->id} email={$user->email} role={$user->role->value} status={$user->status->value}\n";

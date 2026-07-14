<?php

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Enums\UserRole;
use App\Models\User;

$email = $argv[1] ?? '';
if ($email === '') {
    fwrite(STDERR, "Usage: php scripts/promote-user-admin.php user@example.com\n");
    exit(1);
}

$user = User::query()->where('email', $email)->first();
if (! $user) {
    fwrite(STDERR, "User not found: {$email}\n");
    exit(1);
}

$user->update(['role' => UserRole::Admin]);
echo "OK role=admin email={$email}\n";

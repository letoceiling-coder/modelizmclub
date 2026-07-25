<?php

declare(strict_types=1);

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\User;

$admins = User::query()
    ->where('role', 'admin')
    ->whereNull('deleted_at')
    ->orderBy('id')
    ->get(['id', 'email', 'name', 'status']);

if ($admins->isEmpty()) {
    echo "no admin users\n";
    exit(0);
}

foreach ($admins as $u) {
    echo implode("\t", [$u->id, $u->email, $u->name ?? '', $u->status?->value ?? $u->status])."\n";
}

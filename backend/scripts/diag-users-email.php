<?php

declare(strict_types=1);

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\User;

$emails = array_slice($argv, 1);
if ($emails === []) {
    $emails = ['dsc-23@yandex.ru', 'crandimandi@gmail.com', 'dmikhaylov79@yandex.ru'];
}

foreach ($emails as $e) {
    $u = User::withTrashed()->whereRaw('lower(email) = ?', [strtolower($e)])->first();
    if (! $u) {
        echo "{$e} NOT_FOUND\n";
        continue;
    }
    $verified = $u->email_verified_at ? 'yes' : 'no';
    echo "{$e} => db_email={$u->email} status={$u->status->value} verified={$verified}\n";
}

$mixed = User::query()->whereRaw('email <> lower(email)')->count();
echo "users_with_mixed_case_email={$mixed}\n";

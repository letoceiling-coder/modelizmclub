<?php

declare(strict_types=1);

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\User;
use Illuminate\Support\Facades\DB;

$email = strtolower(trim($argv[1] ?? 'dsc-23@yandex.ru'));

echo "=== users with email like {$email} ===\n";
$users = User::withTrashed()->whereRaw('lower(email) = ?', [$email])->get(['id', 'email', 'status', 'deleted_at', 'created_at']);
foreach ($users as $u) {
    echo "id={$u->id} email={$u->email} status={$u->status->value} deleted=".($u->deleted_at ?? 'null')." created={$u->created_at}\n";
}

echo "\n=== recent password_reset_tokens ===\n";
$rows = DB::table('password_reset_tokens')->where('email', $email)->get();
foreach ($rows as $r) {
    echo "email={$r->email} created={$r->created_at}\n";
}

echo "\n=== recent login-related log (grep) ===\n";

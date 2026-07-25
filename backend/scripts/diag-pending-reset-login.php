<?php

declare(strict_types=1);

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Enums\UserStatus;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Modules\Auth\Services\AuthService;

$email = strtolower(trim($argv[1] ?? 'crandimandi@gmail.com'));
$password = $argv[2] ?? 'PendingReset123!';

$user = User::whereRaw('lower(email) = ?', [$email])->first();
if (! $user) {
    echo "FAIL: user not found {$email}\n";
    exit(1);
}

echo "before: status={$user->status->value} verified=".($user->email_verified_at ? 'yes' : 'no')."\n";

$token = Password::createToken($user);
$auth = app(AuthService::class);

try {
    $auth->resetPassword($email, $token, $password, $password);
} catch (Throwable $e) {
    echo 'FAIL reset: '.$e->getMessage()."\n";
    exit(1);
}

$user->refresh();
echo "after reset: status={$user->status->value} verified=".($user->email_verified_at ? 'yes' : 'no')."\n";
echo 'hash_ok='.(Hash::check($password, (string) $user->password) ? 'yes' : 'no')."\n";

try {
    $auth->login($email, $password);
    echo "OK: login after reset+logout simulation\n";
} catch (Throwable $e) {
    echo 'FAIL login: '.$e->getMessage()."\n";
    exit(1);
}

echo "PASS\n";

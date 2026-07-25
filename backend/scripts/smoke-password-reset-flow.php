<?php

declare(strict_types=1);

/**
 * Smoke-test password reset on production/local.
 * Usage: php scripts/smoke-password-reset-flow.php [email] [newPassword]
 */

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Modules\Auth\Services\AuthService;

$email = strtolower(trim($argv[1] ?? 'dsc-23@yandex.ru'));
$password = $argv[2] ?? 'SmokeReset123!';

$user = User::whereRaw('lower(email) = ?', [$email])->first();
if (! $user) {
    echo "FAIL: user not found: {$email}\n";
    exit(1);
}

echo "OK: user id={$user->id}\n";

$token = Password::createToken($user);
$auth = app(AuthService::class);

try {
    $result = $auth->resetPassword($email, $token, $password, $password);
} catch (Throwable $e) {
    echo 'FAIL: resetPassword exception: '.$e->getMessage()."\n";
    exit(1);
}

if (empty($result['token'])) {
    echo "FAIL: resetPassword returned no token\n";
    exit(1);
}

echo "OK: resetPassword token issued\n";

$user->refresh();
if (! Hash::check($password, (string) $user->password)) {
    echo "FAIL: password hash mismatch after reset\n";
    exit(1);
}

echo "OK: password hash verified\n";

try {
    $login = $auth->login($email, $password);
} catch (Throwable $e) {
    echo 'FAIL: login after reset: '.$e->getMessage()."\n";
    exit(1);
}

if (empty($login['token'])) {
    echo "FAIL: login returned no token\n";
    exit(1);
}

echo "OK: login after reset works\n";
echo "PASS: password reset flow\n";

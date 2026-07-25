<?php

declare(strict_types=1);

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;

$email = $argv[1] ?? 'dsc-23@yandex.ru';
$newPassword = $argv[2] ?? 'TestReset123!';

$email = strtolower(trim($email));
$user = User::where('email', $email)->first();
if (! $user) {
    echo "user not found: {$email}\n";
    exit(1);
}

echo "user id={$user->id} status={$user->status->value}\n";
echo "password hash prefix: ".substr((string) $user->password, 0, 20)."...\n";

$token = Password::createToken($user);
echo "created token: ".substr($token, 0, 8)."...\n";

$status = Password::reset(
    [
        'email' => $email,
        'token' => $token,
        'password' => $newPassword,
        'password_confirmation' => $newPassword,
    ],
    function (User $resetUser, string $plainPassword): void {
        $resetUser->forceFill([
            'password' => $plainPassword,
            'remember_token' => Illuminate\Support\Str::random(60),
        ])->save();
    }
);

echo "reset status: {$status}\n";

$user->refresh();
$check = Hash::check($newPassword, (string) $user->password);
echo "Hash::check after reset: ".($check ? 'OK' : 'FAIL')."\n";
echo "password hash prefix after: ".substr((string) $user->password, 0, 20)."...\n";

// Simulate AuthService::login
$loginUser = User::where('email', $email)->first();
$loginOk = $loginUser && Hash::check($newPassword, (string) $loginUser->password);
echo "AuthService login simulation: ".($loginOk ? 'OK' : 'FAIL')."\n";

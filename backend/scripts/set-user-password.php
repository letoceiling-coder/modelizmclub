<?php

declare(strict_types=1);

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Modules\Auth\Services\AuthService;

$email = strtolower(trim($argv[1] ?? ''));
$password = $argv[2] ?? '';

if ($email === '' || $password === '') {
    echo "Usage: php scripts/set-user-password.php email password\n";
    exit(1);
}

$user = User::query()->whereRaw('lower(email) = ?', [$email])->first();
if (! $user) {
    echo "FAIL: user not found {$email}\n";
    exit(1);
}

$user->forceFill(['password' => $password])->save();
$user->refresh();

if (! Hash::check($password, (string) $user->password)) {
    echo "FAIL: hash mismatch after save\n";
    exit(1);
}

try {
    app(AuthService::class)->login($email, $password);
    echo "OK: password set and login verified for {$email}\n";
} catch (Throwable $e) {
    echo 'FAIL login: '.$e->getMessage()."\n";
    exit(1);
}

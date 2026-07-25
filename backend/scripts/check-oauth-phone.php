<?php

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$email = $argv[1] ?? 'dsc-23@yandex.ru';
$user = App\Models\User::query()->where('email', $email)->first();

if (! $user) {
    fwrite(STDERR, "User not found: {$email}\n");
    exit(1);
}

echo "USER: ".json_encode($user->only(['id', 'email', 'phone', 'phone_verified_at']), JSON_UNESCAPED_UNICODE)."\n";

$oauth = App\Models\UserOAuthAccount::query()
    ->where('user_id', $user->id)
    ->where('provider', 'yandex')
    ->first();

if (! $oauth) {
    fwrite(STDERR, "No yandex oauth account linked\n");
    exit(1);
}

$token = $oauth->token['access_token'] ?? null;
echo "OAUTH_LINKED: provider_user_id={$oauth->provider_user_id}\n";

if (! is_string($token) || $token === '') {
    fwrite(STDERR, "No access token stored\n");
    exit(1);
}

$response = Illuminate\Support\Facades\Http::withToken($token)
    ->get('https://login.yandex.ru/info', ['format' => 'json']);

echo "YANDEX_INFO_STATUS: ".$response->status()."\n";
echo "YANDEX_INFO_BODY: ".$response->body()."\n";

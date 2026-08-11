<?php

/**
 * Smoke-test VTB callback checksum against production webhook.
 * Usage: php deploy/scripts/test-vtb-callback-checksum.php
 */
require __DIR__.'/../../backend/vendor/autoload.php';
$app = require __DIR__.'/../../backend/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Modules\Billing\Support\VtbCallbackChecksumValidator;

$secret = (string) config('billing.vtb.callback_token');
$url = getenv('WEBHOOK_URL') ?: 'https://api.modelizmclub.ru/api/v1/payments/webhooks/vtb';

$params = [
    'mdOrder' => 'smoke-'.bin2hex(random_bytes(4)),
    'operation' => 'deposited',
    'status' => '1',
];

$validator = new VtbCallbackChecksumValidator($secret);
$params['checksum'] = $validator->compute($params);

$body = http_build_query($params);
$ctx = stream_context_create([
    'http' => [
        'method' => 'POST',
        'header' => "Content-Type: application/x-www-form-urlencoded\r\n",
        'content' => $body,
        'ignore_errors' => true,
    ],
]);

$response = file_get_contents($url, false, $ctx);
$statusLine = $http_response_header[0] ?? '';

echo "POST {$url}\n";
echo "Status: {$statusLine}\n";
echo "Body: {$response}\n";

if (! str_contains($statusLine, '200') || ! str_contains((string) $response, '"status":"ok"')) {
    exit(1);
}

echo "OK callback checksum accepted\n";

<?php

require __DIR__.'/../vendor/autoload.php';

$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\Http;
use Modules\Delivery\Services\CdekApiExtension;
use Modules\Delivery\Services\CdekTokenCache;

$url = 'https://modelizmclub.ru/api/v1/webhooks/cdek/order-status';
$type = 'ORDER_STATUS';

$baseUrl = config('cdek.test')
    ? (string) config('cdek.api_url_test')
    : (string) config('cdek.api_url');

echo 'CDEK API: '.$baseUrl."\n";
echo 'Webhook URL: '.$url."\n\n";

// Warm OAuth token.
app(CdekApiExtension::class)->listDeliveryPoints(['size' => 1]);

$tokenPayload = app(CdekTokenCache::class)->get();
if ($tokenPayload === null) {
    fwrite(STDERR, "Failed to obtain CDEK OAuth token.\n");
    exit(1);
}

$http = Http::baseUrl($baseUrl)
    ->timeout((float) config('cdek.timeout', 10.0))
    ->acceptJson()
    ->withToken($tokenPayload['access_token']);

echo "=== GET /webhooks ===\n";
$listResponse = $http->get('webhooks');
echo 'HTTP '.$listResponse->status()."\n";
$existing = $listResponse->json();
print_r($existing);

$items = [];
if (is_array($existing)) {
    if (isset($existing['entity']) && is_array($existing['entity'])) {
        $items = $existing['entity'];
    } elseif (array_is_list($existing)) {
        $items = $existing;
    }
}

foreach ($items as $hook) {
    if (! is_array($hook)) {
        continue;
    }
    if (($hook['url'] ?? null) === $url && ($hook['type'] ?? null) === $type) {
        echo "\nAlready registered: {$type} -> {$url}\n";
        echo 'UUID: '.($hook['uuid'] ?? 'n/a')."\n";
        exit(0);
    }
}

echo "\n=== POST /webhooks ===\n";
$createResponse = $http->post('webhooks', [
    'type' => $type,
    'url' => $url,
]);
echo 'HTTP '.$createResponse->status()."\n";
echo $createResponse->body()."\n";

if (! $createResponse->successful()) {
    fwrite(STDERR, "Webhook registration failed.\n");
    exit(1);
}

echo "\n=== Verify GET /webhooks ===\n";
$verifyResponse = $http->get('webhooks');
echo 'HTTP '.$verifyResponse->status()."\n";
print_r($verifyResponse->json());

echo "\n=== Verify public endpoint ===\n";
$probe = Http::timeout(10)
    ->withHeaders(['Content-Type' => 'application/json'])
    ->post($url, ['uuid' => 'probe-'.time()]);
echo 'Public POST '.$url.' -> HTTP '.$probe->status()."\n";
echo $probe->body()."\n";

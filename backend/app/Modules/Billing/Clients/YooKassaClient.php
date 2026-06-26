<?php

namespace Modules\Billing\Clients;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * YooKassa REST API v3 client.
 *
 * @see https://yookassa.ru/developers/api
 */
class YooKassaClient
{
    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    public function createPayment(array $payload, string $idempotenceKey): array
    {
        return $this->request('POST', '/payments', $payload, $idempotenceKey);
    }

    /**
     * @return array<string, mixed>
     */
    public function getPayment(string $paymentId): array
    {
        return $this->request('GET', "/payments/{$paymentId}");
    }

    /**
     * @param  array<string, mixed>|null  $payload
     * @return array<string, mixed>
     */
    private function request(string $method, string $path, ?array $payload = null, ?string $idempotenceKey = null): array
    {
        $shopId = (string) config('billing.yookassa.shop_id');
        $secret = (string) config('billing.yookassa.secret_key');
        $url = config('billing.yookassa.api_url').$path;

        $pending = Http::withBasicAuth($shopId, $secret)
            ->acceptJson()
            ->timeout(30);

        if ($idempotenceKey) {
            $pending = $pending->withHeaders(['Idempotence-Key' => $idempotenceKey]);
        }

        $response = match (strtoupper($method)) {
            'GET' => $pending->get($url),
            'POST' => $pending->post($url, $payload ?? []),
            default => throw new RuntimeException("Unsupported HTTP method {$method}"),
        };

        return $this->decode($response, $path);
    }

    /**
     * @return array<string, mixed>
     */
    private function decode(Response $response, string $path): array
    {
        /** @var array<string, mixed>|null $data */
        $data = $response->json();

        if (! $response->successful() || ! is_array($data)) {
            $description = is_array($data) ? ($data['description'] ?? $response->body()) : $response->body();

            throw new RuntimeException("YooKassa {$path}: {$description}");
        }

        return $data;
    }
}

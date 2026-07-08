<?php

namespace Modules\Delivery\Services;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Modules\Delivery\Contracts\YandexGateway;
use Modules\Delivery\Exceptions\YandexDeliveryApiException;
use RuntimeException;

class YandexDeliveryService implements YandexGateway
{
    public function listPickupPoints(array $body): array
    {
        return $this->request('POST', '/api/b2b/platform/pickup-points/list', $body);
    }

    public function detectLocation(array $body): array
    {
        return $this->request('POST', '/api/b2b/platform/location/detect', $body);
    }

    public function calculatePrice(array $body): array
    {
        return $this->request('POST', '/api/b2b/platform/pricing-calculator', $body);
    }

    public function createOffer(array $body): array
    {
        return $this->request('POST', '/api/b2b/platform/offers/create', $body);
    }

    public function getRequestInfo(array $query): array
    {
        return $this->request('GET', '/api/b2b/platform/request/info', [], $query);
    }

    /**
     * @param  array<string, mixed>  $body
     * @param  array<string, mixed>  $query
     * @return array<string, mixed>
     */
    private function request(string $method, string $path, array $body = [], array $query = []): array
    {
        if (! config('yandex-delivery.enabled')) {
            throw new RuntimeException('Yandex Delivery integration is disabled.');
        }

        $token = (string) config('yandex-delivery.token');
        if ($token === '') {
            throw new RuntimeException('YANDEX_DELIVERY_TOKEN is not configured.');
        }

        $http = Http::baseUrl((string) config('yandex-delivery.api_url'))
            ->timeout((float) config('yandex-delivery.timeout', 15.0))
            ->acceptJson()
            ->withToken($token);

        $response = match (strtoupper($method)) {
            'GET' => $http->get($path, $query),
            'POST' => $http->post($path, $body),
            default => throw new YandexDeliveryApiException('Unsupported HTTP method: '.$method),
        };

        return $this->decode($response, $method.' '.$path);
    }

    /**
     * @return array<string, mixed>
     */
    private function decode(Response $response, string $operation): array
    {
        if ($response->status() >= 400) {
            throw new YandexDeliveryApiException(
                'Yandex Delivery API error on '.$operation.': '.$response->body(),
                $response->status(),
                is_array($response->json()) ? $response->json() : null,
            );
        }

        $json = $response->json();
        if (! is_array($json)) {
            throw new YandexDeliveryApiException('Yandex Delivery returned non-JSON for '.$operation, $response->status());
        }

        return $json;
    }
}

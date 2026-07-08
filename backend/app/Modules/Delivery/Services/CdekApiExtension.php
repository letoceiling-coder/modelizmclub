<?php

namespace Modules\Delivery\Services;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Modules\Delivery\Exceptions\CdekApiException;

/**
 * Methods missing from antistress-store/cdek-sdk-v2 (v1.6).
 *
 * @see docs/CDEK-API-AUDIT.md
 */
class CdekApiExtension
{
    public function __construct(
        private readonly CdekTokenCache $tokenCache,
    ) {}

    /**
     * @param  array<string, scalar|null>  $query
     * @return array<string, mixed>
     */
    public function listOrders(array $query = []): array
    {
        return $this->request('GET', 'orders', $query);
    }

    /**
     * @param  array<string, scalar|null>  $query
     * @return array<string, mixed>
     */
    public function listIntakes(array $query = []): array
    {
        return $this->request('GET', 'intakes', $query);
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    public function createPrealert(array $payload): array
    {
        return $this->request('POST', 'prealert', [], $payload);
    }

    /**
     * @return array<string, mixed>
     */
    public function getPrealert(string $uuid): array
    {
        return $this->request('GET', 'prealert/'.$uuid);
    }

    /**
     * @param  array<string, scalar|null>  $query
     * @return array<int, array<string, mixed>>
     */
    public function listDeliveryPoints(array $query = []): array
    {
        $result = $this->request('GET', 'deliverypoints', $query);

        return is_array($result) ? $result : [];
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    public function calculateTariffList(array $payload): array
    {
        return $this->request('POST', 'calculator/tarifflist', [], $payload);
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    public function createOrder(array $payload): array
    {
        return $this->request('POST', 'orders', [], $payload);
    }

    /**
     * @return array<string, mixed>
     */
    public function getOrder(string $uuid): array
    {
        return $this->request('GET', 'orders/'.$uuid);
    }

    /**
     * @param  array<string, scalar|null>  $query
     * @return array<int, array<string, mixed>>
     */
    public function listCities(array $query = []): array
    {
        $result = $this->request('GET', 'location/cities', $query);

        return is_array($result) ? $result : [];
    }

    /**
     * @param  array<string, scalar|null>  $query
     * @param  array<string, mixed>|null  $json
     * @return array<string, mixed>
     */
    private function request(string $method, string $path, array $query = [], ?array $json = null): array
    {
        $response = $this->send($method, $path, $query, $json, allowRetry: true);

        return $this->decode($response, $method.' '.$path);
    }

    /**
     * @param  array<string, scalar|null>  $query
     * @param  array<string, mixed>|null  $json
     */
    private function send(string $method, string $path, array $query, ?array $json, bool $allowRetry): Response
    {
        $token = $this->resolveAccessToken();
        $http = $this->httpClient($token);

        $options = [];
        if ($query !== []) {
            $options['query'] = array_filter($query, fn ($v) => $v !== null && $v !== '');
        }
        if ($json !== null) {
            $options['json'] = $json;
        }

        $response = match (strtoupper($method)) {
            'GET' => $http->get($path, $options['query'] ?? []),
            'POST' => $http->post($path, $options['json'] ?? []),
            'PATCH' => $http->patch($path, $options['json'] ?? []),
            'DELETE' => $http->delete($path, $options['query'] ?? []),
            default => throw new CdekApiException('Unsupported HTTP method: '.$method),
        };

        if ($response->status() === 401 && $allowRetry) {
            $this->tokenCache->forget();

            return $this->send($method, $path, $query, $json, allowRetry: false);
        }

        return $response;
    }

    private function resolveAccessToken(): string
    {
        $cached = $this->tokenCache->get();
        if ($cached !== null && $cached['expires_in'] > time() && $cached['access_token'] !== '') {
            return $cached['access_token'];
        }

        return $this->authorize();
    }

    private function authorize(): string
    {
        $test = (bool) config('cdek.test', true);

        if ($test) {
            $account = \AntistressStore\CdekSDK2\Constants::TEST_ACCOUNT;
            $secure = \AntistressStore\CdekSDK2\Constants::TEST_SECURE;
            $accountType = 'TEST';
        } else {
            $account = (string) config('cdek.account');
            $secure = (string) config('cdek.secure');

            if ($account === '' || $secure === '') {
                throw new CdekApiException('CDEK credentials are not configured.');
            }

            $accountType = 'COMBAT';
        }

        $response = Http::asForm()
            ->timeout((float) config('cdek.timeout', 10.0))
            ->post($this->baseUrl().'oauth/token?parameters', [
                'grant_type' => 'client_credentials',
                'client_id' => $account,
                'client_secret' => $secure,
            ]);

        if (! $response->successful()) {
            throw new CdekApiException(
                'CDEK OAuth failed: '.$response->body(),
                $response->status(),
            );
        }

        /** @var array{access_token?:string,expires_in?:int} $data */
        $data = $response->json() ?? [];
        $token = (string) ($data['access_token'] ?? '');
        $expiresIn = (int) ($data['expires_in'] ?? 3600);

        if ($token === '') {
            throw new CdekApiException('CDEK OAuth response did not contain access_token.');
        }

        $this->tokenCache->put([
            'access_token' => $token,
            'expires_in' => time() + max(60, $expiresIn - 10),
            'account_type' => $accountType,
        ]);

        return $token;
    }

    private function httpClient(string $token): PendingRequest
    {
        return Http::baseUrl($this->baseUrl())
            ->timeout((float) config('cdek.timeout', 10.0))
            ->acceptJson()
            ->withToken($token);
    }

    private function baseUrl(): string
    {
        return (bool) config('cdek.test', true)
            ? (string) config('cdek.api_url_test')
            : (string) config('cdek.api_url');
    }

    /**
     * @return array<string, mixed>
     */
    private function decode(Response $response, string $operation): array
    {
        if ($response->status() >= 400) {
            throw new CdekApiException(
                'CDEK API error on '.$operation.': '.$response->body(),
                $response->status(),
                is_array($response->json()) ? $response->json() : null,
            );
        }

        $json = $response->json();

        if (! is_array($json)) {
            throw new CdekApiException('CDEK API returned non-JSON response for '.$operation, $response->status());
        }

        return $json;
    }
}

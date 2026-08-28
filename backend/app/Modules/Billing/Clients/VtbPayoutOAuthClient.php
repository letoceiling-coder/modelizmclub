<?php

namespace Modules\Billing\Clients;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Shared OAuth2 client_credentials token + Open API headers for VTB ОЭ
 * (SBP B2C and card A2C). X-IBM-Client-Id is lowercase without @ext.vtb.ru
 * and is never sent to /token.
 */
class VtbPayoutOAuthClient
{
    public const CACHE_KEY = 'vtb_payout.oauth_token';

    /**
     * Token lifetime is ~179s; refresh a bit early so callers never send an
     * already-expired Bearer.
     */
    private const EXPIRY_SKEW_SECONDS = 15;

    public function accessToken(): string
    {
        $cached = Cache::get(self::CACHE_KEY);

        if (is_string($cached) && $cached !== '') {
            return $cached;
        }

        $response = Http::asForm()
            ->acceptJson()
            ->connectTimeout(10)
            ->timeout(20)
            ->post((string) config('billing.vtb_payout.oauth_url'), [
                'grant_type' => 'client_credentials',
                'client_id' => (string) config('billing.vtb_payout.client_id'),
                'client_secret' => (string) config('billing.vtb_payout.client_secret'),
            ]);

        $data = $this->decode($response, 'oauth2/token');
        $token = (string) ($data['access_token'] ?? '');

        if ($token === '') {
            throw new RuntimeException('VTB oauth2/token missing access_token');
        }

        $ttl = max(1, (int) ($data['expires_in'] ?? 179) - self::EXPIRY_SKEW_SECONDS);
        Cache::put(self::CACHE_KEY, $token, $ttl);

        return $token;
    }

    /**
     * Header value: lowercase, domain stripped (EXT.ORG@ext.vtb.ru → ext.org).
     */
    public function ibmClientId(): string
    {
        $id = strtolower(trim((string) config('billing.vtb_payout.client_id')));
        $at = strpos($id, '@');

        if ($at !== false) {
            $id = substr($id, 0, $at);
        }

        return $id;
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    public function postJson(string $path, array $payload = []): array
    {
        return $this->decode(
            $this->jsonRequest()->post($this->apiUrl($path), $payload),
            $path,
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function getJson(string $path): array
    {
        return $this->decode(
            $this->jsonRequest()->get($this->apiUrl($path)),
            $path,
        );
    }

    public function apiUrl(string $path): string
    {
        return rtrim((string) config('billing.vtb_payout.api_url'), '/').'/'.ltrim($path, '/');
    }

    public static function rubFromKopecks(int $kopecks): float
    {
        return round($kopecks / 100, 2);
    }

    private function jsonRequest(): PendingRequest
    {
        $headers = [
            'X-IBM-Client-Id' => $this->ibmClientId(),
        ];

        $merchant = (string) config('billing.vtb_payout.merchant_authorization');
        if ($merchant !== '') {
            $headers['Merchant-Authorization'] = $merchant;
        }

        $source = (string) config('billing.vtb_payout.source_system_id');
        if ($source !== '') {
            $headers['Source-System-Id'] = $source;
        }

        return Http::acceptJson()
            ->asJson()
            ->withToken($this->accessToken())
            ->withHeaders($headers)
            ->connectTimeout(10)
            ->timeout(30);
    }

    /**
     * @return array<string, mixed>
     */
    private function decode(Response $response, string $endpoint): array
    {
        /** @var mixed $data */
        $data = $response->json();

        if (! $response->successful() || ! is_array($data)) {
            $snippet = is_array($data)
                ? json_encode($data, JSON_UNESCAPED_UNICODE)
                : mb_substr($response->body(), 0, 400);

            throw new RuntimeException("VTB {$endpoint} HTTP {$response->status()}: {$snippet}");
        }

        return $data;
    }
}

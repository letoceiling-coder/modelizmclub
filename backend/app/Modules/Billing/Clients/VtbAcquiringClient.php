<?php

namespace Modules\Billing\Clients;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * VTB internet acquiring REST client (ИЭ / RBS).
 *
 * One-stage: register.do → buyer pays → orderStatus 2 (deposited).
 * Two-stage hold: registerPreAuth.do → orderStatus 1 → deposit.do / reverse.do.
 *
 * @see https://sandbox.vtb.ru/sandbox/ru/integration/api/rest.html
 * @see https://sandbox.vtb.ru/sandbox/ru/integration/api/scripts.html#mp3-autocompletion
 */
class VtbAcquiringClient
{
    /**
     * @param  array<string, mixed>  $params
     * @return array<string, mixed>
     */
    public function registerOrder(array $params): array
    {
        return $this->post('register.do', $params);
    }

    /**
     * Two-stage hold (pre-auth). Same body as register.do.
     *
     * @param  array<string, mixed>  $params
     * @return array<string, mixed>
     */
    public function registerPreAuth(array $params): array
    {
        return $this->post('registerPreAuth.do', $params);
    }

    /**
     * Capture a held pre-auth. Amount is minor units (kopecks); omit for full remainder.
     *
     * @return array<string, mixed>
     */
    public function deposit(string $orderId, ?int $amountKopecks = null): array
    {
        $params = ['orderId' => $orderId];

        if ($amountKopecks !== null) {
            $params['amount'] = $amountKopecks;
        }

        return $this->post('deposit.do', $params);
    }

    /**
     * Cancel an uncaptured pre-auth.
     *
     * @return array<string, mixed>
     */
    public function reverse(string $orderId): array
    {
        return $this->post('reverse.do', ['orderId' => $orderId]);
    }

    /**
     * Refund a captured payment. Amount is minor units (kopecks).
     *
     * @return array<string, mixed>
     */
    public function refund(string $orderId, int $amountKopecks): array
    {
        return $this->post('refund.do', [
            'orderId' => $orderId,
            'amount' => $amountKopecks,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function getOrderStatusExtended(string $orderId): array
    {
        return $this->post('getOrderStatusExtended.do', [
            'orderId' => $orderId,
        ]);
    }

    /**
     * @param  array<string, mixed>  $params
     * @return array<string, mixed>
     */
    private function post(string $endpoint, array $params): array
    {
        $auth = $this->authParams();
        $response = Http::asForm()
            ->timeout(30)
            ->post($this->apiUrl($endpoint), array_merge($auth, $params));

        return $this->decode($response, $endpoint);
    }

    /**
     * @return array<string, string>
     */
    private function authParams(): array
    {
        $token = config('billing.vtb.token');

        if ($token) {
            return ['token' => $token];
        }

        return [
            'userName' => (string) config('billing.vtb.username'),
            'password' => (string) config('billing.vtb.password'),
        ];
    }

    private function apiUrl(string $endpoint): string
    {
        return config('billing.vtb.api_url').ltrim($endpoint, '/');
    }

    /**
     * @return array<string, mixed>
     */
    private function decode(Response $response, string $endpoint): array
    {
        if (! $response->successful()) {
            throw new RuntimeException("VTB {$endpoint} HTTP {$response->status()}");
        }

        /** @var array<string, mixed>|null $data */
        $data = $response->json();

        if (! is_array($data)) {
            throw new RuntimeException("VTB {$endpoint} returned invalid JSON");
        }

        if (isset($data['errorCode']) && (string) $data['errorCode'] !== '0') {
            $message = (string) ($data['errorMessage'] ?? 'Unknown VTB error');

            throw new RuntimeException("VTB {$endpoint}: {$message} (code {$data['errorCode']})");
        }

        return $data;
    }

    public static function orderStatus(array $statusResponse): ?int
    {
        $orderStatus = $statusResponse['orderStatus'] ?? null;

        if (is_array($orderStatus)) {
            $orderStatus = $orderStatus['orderStatus'] ?? null;
        }

        return $orderStatus === null || $orderStatus === '' ? null : (int) $orderStatus;
    }

    public static function isPaidStatus(array $statusResponse): bool
    {
        return in_array(self::orderStatus($statusResponse), [1, 2], true);
    }

    public static function isAuthorizedStatus(array $statusResponse): bool
    {
        return self::orderStatus($statusResponse) === 1;
    }

    public static function isCapturedStatus(array $statusResponse): bool
    {
        return self::orderStatus($statusResponse) === 2;
    }
}

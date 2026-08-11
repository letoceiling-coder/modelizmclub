<?php

namespace Modules\Billing\Clients;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * VTB internet acquiring REST client (register.do / getOrderStatusExtended.do).
 */
class VtbAcquiringClient
{
    public function registerOrder(array $params): array
    {
        return $this->post('register.do', $params);
    }

    public function registerPreAuthOrder(array $params): array
    {
        return $this->post('registerPreAuth.do', $params);
    }

    public function depositOrder(string $orderId, ?int $amountCents = null): array
    {
        $params = ['orderId' => $orderId];
        if ($amountCents !== null) {
            $params['amount'] = $amountCents;
        }

        return $this->post('deposit.do', $params);
    }

    public function reverseOrder(string $orderId): array
    {
        return $this->post('reverse.do', ['orderId' => $orderId]);
    }

    public function refundOrder(string $orderId, ?int $amountCents = null): array
    {
        $params = ['orderId' => $orderId];
        if ($amountCents !== null) {
            $params['amount'] = $amountCents;
        }

        return $this->post('refund.do', $params);
    }

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

    public static function isPaidStatus(array $statusResponse): bool
    {
        $orderStatus = $statusResponse['orderStatus'] ?? null;

        if (is_array($orderStatus)) {
            $orderStatus = $orderStatus['orderStatus'] ?? null;
        }

        return in_array((int) $orderStatus, [1, 2], true);
    }

    /** Pre-authorized (hold) but not yet deposited. */
    public static function isAuthorizedHold(array $statusResponse): bool
    {
        $orderStatus = $statusResponse['orderStatus'] ?? null;

        if (is_array($orderStatus)) {
            $orderStatus = $orderStatus['orderStatus'] ?? null;
        }

        return (int) $orderStatus === 1;
    }

    public static function isDeposited(array $statusResponse): bool
    {
        $orderStatus = $statusResponse['orderStatus'] ?? null;

        if (is_array($orderStatus)) {
            $orderStatus = $orderStatus['orderStatus'] ?? null;
        }

        return (int) $orderStatus === 2;
    }

    public static function isReversed(array $statusResponse): bool
    {
        $orderStatus = $statusResponse['orderStatus'] ?? null;

        if (is_array($orderStatus)) {
            $orderStatus = $orderStatus['orderStatus'] ?? null;
        }

        return in_array((int) $orderStatus, [3, 4], true);
    }
}

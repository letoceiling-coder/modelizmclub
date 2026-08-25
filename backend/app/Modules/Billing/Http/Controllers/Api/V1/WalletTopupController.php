<?php

namespace Modules\Billing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Billing\Contracts\PaymentGateway;
use Modules\Billing\Services\VtbPaymentGateway;

class WalletTopupController extends Controller
{
    public function __invoke(Request $request, PaymentGateway $gateway, VtbPaymentGateway $vtb): JsonResponse
    {
        $mode = (string) config('billing.provider', 'auto');

        if ($mode === 'vtb' && ! $vtb->isConfigured()) {
            return response()->json([
                'message' => 'Пополнение баланса доступно только через ВТБ Эквайринг. Платёжный шлюз не настроен.',
                'code' => 'vtb_required',
            ], 503);
        }

        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:100', 'max:1000000'],
            'idempotency_key' => ['nullable', 'string', 'max:128'],
            'return_url' => ['nullable', 'string', 'max:2048'],
        ]);

        $amountKopecks = (int) round(((float) $data['amount']) * 100);
        $frontend = rtrim((string) config('billing.frontend_url'), '/');
        $returnUrl = $this->sameOriginReturnUrl($data['return_url'] ?? null, $frontend, '/settings/wallet?payment=success');
        $failUrl = $this->sameOriginReturnUrl(null, $frontend, '/settings/wallet?payment=failed');

        $result = $gateway->createCheckout(
            $request->user(),
            $amountKopecks,
            config('billing.currency', 'RUB'),
            'Пополнение баланса МоДелизМ',
            [
                'payable_type' => 'wallet_topup',
                'idempotency_key' => $data['idempotency_key'] ?? null,
                'return_url' => $returnUrl,
                'fail_url' => $failUrl,
            ],
        );

        if (empty($result['checkout_url'])) {
            return response()->json([
                'message' => 'Не удалось открыть оплату. Попробуйте позже.',
                'code' => 'checkout_unavailable',
            ], 502);
        }

        $providerLabel = ($result['provider'] ?? null) === 'vtb' ? 'ВТБ Эквайринг' : 'тестовый контур';

        return response()->json([
            'data' => $result,
            'message' => "Платёж создан. Перенаправление на оплату ({$providerLabel}).",
        ], 201);
    }

    private function sameOriginReturnUrl(?string $url, string $frontend, string $fallbackPath): string
    {
        $fallback = $frontend.$fallbackPath;
        if (! is_string($url) || $url === '') {
            return $fallback;
        }

        if (str_starts_with($url, '/') && ! str_starts_with($url, '//')) {
            return $frontend.$url;
        }

        $parsed = parse_url($url);
        $front = parse_url($frontend);
        if (! is_array($parsed) || ! is_array($front)) {
            return $fallback;
        }

        $host = strtolower((string) ($parsed['host'] ?? ''));
        $allowed = strtolower((string) ($front['host'] ?? ''));
        if ($host === '' || $allowed === '' || $host !== $allowed) {
            return $fallback;
        }

        return $url;
    }
}

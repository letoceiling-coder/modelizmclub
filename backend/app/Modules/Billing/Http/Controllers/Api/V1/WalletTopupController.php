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
        ]);

        $amountKopecks = (int) round(((float) $data['amount']) * 100);
        $frontend = rtrim((string) config('billing.frontend_url'), '/');

        $result = $gateway->createCheckout(
            $request->user(),
            $amountKopecks,
            config('billing.currency', 'RUB'),
            'Пополнение баланса МоДелизМ',
            [
                'payable_type' => 'wallet_topup',
                'idempotency_key' => $data['idempotency_key'] ?? null,
                'return_url' => $frontend.'/settings/wallet?payment=success',
                'fail_url' => $frontend.'/settings/wallet?payment=failed',
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
}

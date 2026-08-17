<?php

namespace Modules\Billing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Billing\Contracts\PaymentGateway;

class WalletTopupController extends Controller
{
    public function __invoke(Request $request, PaymentGateway $gateway): JsonResponse
    {
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:100', 'max:1000000'],
            'idempotency_key' => ['nullable', 'string', 'max:128'],
        ]);

        $amountKopecks = (int) round(((float) $data['amount']) * 100);

        $result = $gateway->createCheckout(
            $request->user(),
            $amountKopecks,
            config('billing.currency', 'RUB'),
            'Пополнение баланса МоДелизМ',
            [
                'payable_type' => 'wallet_topup',
                'idempotency_key' => $data['idempotency_key'] ?? null,
            ],
        );

        return response()->json([
            'data' => $result,
            'message' => $result['checkout_url']
                ? 'Платёж создан. Перенаправление на оплату.'
                : 'Платёж создан. Подтвердите оплату в тестовом режиме.',
        ], 201);
    }
}

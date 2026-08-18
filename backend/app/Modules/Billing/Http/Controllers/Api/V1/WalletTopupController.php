<?php

namespace Modules\Billing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Billing\Services\VtbPaymentGateway;

class WalletTopupController extends Controller
{
    public function __invoke(Request $request, VtbPaymentGateway $vtb): JsonResponse
    {
        if (! $vtb->isConfigured()) {
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

        $result = $vtb->createCheckout(
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

        if (($result['provider'] ?? null) !== 'vtb' || empty($result['checkout_url'])) {
            return response()->json([
                'message' => 'Не удалось открыть оплату через ВТБ. Попробуйте позже.',
                'code' => 'vtb_required',
            ], 502);
        }

        return response()->json([
            'data' => $result,
            'message' => 'Платёж создан. Перенаправление на оплату ВТБ.',
        ], 201);
    }
}

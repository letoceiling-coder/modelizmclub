<?php

namespace Modules\Billing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Billing\Services\VtbPaymentGateway;
use Modules\Billing\Services\YooKassaPaymentGateway;

class SyncPaymentController extends Controller
{
    public function __invoke(Request $request, string $uuid): JsonResponse
    {
        $payment = Payment::query()
            ->where('uuid', $uuid)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        if ($payment->status === 'paid') {
            return response()->json([
                'data' => ['status' => 'paid', 'payment_uuid' => $payment->uuid],
            ]);
        }

        match ($payment->provider) {
            'vtb' => app(VtbPaymentGateway::class)->syncByProviderOrderId((string) $payment->provider_payment_id),
            'yookassa' => app(YooKassaPaymentGateway::class)->syncSucceeded((string) $payment->provider_payment_id),
            default => null,
        };

        $payment->refresh();

        return response()->json([
            'data' => [
                'status' => $payment->status,
                'payment_uuid' => $payment->uuid,
                'provider' => $payment->provider,
            ],
        ]);
    }
}

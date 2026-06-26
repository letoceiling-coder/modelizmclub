<?php

namespace Modules\Billing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ShowPaymentController extends Controller
{
    public function __invoke(Request $request, string $uuid): JsonResponse
    {
        $payment = Payment::query()
            ->where('uuid', $uuid)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        return response()->json([
            'data' => [
                'payment_uuid' => $payment->uuid,
                'status' => $payment->status,
                'provider' => $payment->provider,
                'amount_cents' => $payment->amount_cents,
                'currency' => $payment->currency,
                'paid_at' => $payment->paid_at?->toIso8601String(),
                'metadata' => $payment->metadata,
            ],
        ]);
    }
}

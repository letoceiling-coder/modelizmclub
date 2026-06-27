<?php

namespace Modules\Billing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Billing\Services\StubPaymentGateway;

/** Dev-only: confirm stub payment without external gateway. */
class ConfirmStubPaymentController extends Controller
{
    public function __invoke(Request $request, string $uuid, StubPaymentGateway $gateway): JsonResponse
    {
        $payment = Payment::query()
            ->where('uuid', $uuid)
            ->where('user_id', $request->user()->id)
            ->where('provider', 'stub')
            ->firstOrFail();

        $gateway->handleWebhook(['payment_uuid' => $payment->uuid]);

        return response()->json(['message' => 'Stub payment confirmed.']);
    }
}

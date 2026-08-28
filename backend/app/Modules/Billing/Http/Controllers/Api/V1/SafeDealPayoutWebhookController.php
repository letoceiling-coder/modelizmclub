<?php

namespace Modules\Billing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Modules\Billing\Services\SafeDealPayoutService;

/**
 * VTB ОЭ callbacks for seller payouts (SBP_B2C_PAYMENT_AUTHORIZE / _FINAL).
 *
 * The callback body is advisory: we record it, then re-read the payout from the
 * bank so a spoofed call cannot mark money as paid.
 */
class SafeDealPayoutWebhookController extends Controller
{
    public function __invoke(Request $request, SafeDealPayoutService $payouts): JsonResponse
    {
        $requestId = (string) ($request->input('requestId') ?? $request->input('request_id') ?? '');

        if ($requestId === '') {
            Log::warning('SafeDeal payout webhook without requestId', $request->all());

            return response()->json(['status' => 'ignored']);
        }

        $payout = $payouts->findByRequestId($requestId);

        if ($payout === null) {
            Log::warning('SafeDeal payout webhook: unknown requestId', ['requestId' => $requestId]);

            return response()->json(['status' => 'ignored']);
        }

        $payouts->advance($payout);

        return response()->json(['status' => 'ok']);
    }
}

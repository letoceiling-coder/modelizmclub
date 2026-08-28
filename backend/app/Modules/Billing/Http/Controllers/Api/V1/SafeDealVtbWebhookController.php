<?php

namespace Modules\Billing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Modules\Billing\Services\SafeDealHoldSyncService;

/**
 * RBS dynamicCallbackUrl for safe-deal pre-auths.
 *
 * The callback carries no trustworthy state, so we only take the order id from
 * it and ask VTB for the authoritative status — a forged call can at worst make
 * us re-read a status we already have.
 */
class SafeDealVtbWebhookController extends Controller
{
    public function __invoke(Request $request, SafeDealHoldSyncService $sync): JsonResponse
    {
        $orderId = (string) ($request->input('mdOrder') ?? $request->input('orderId') ?? '');

        if ($orderId === '') {
            Log::warning('SafeDeal VTB webhook without order id', $request->all());

            return response()->json(['status' => 'ignored']);
        }

        $sync->syncByRbsOrderId($orderId);

        return response()->json(['status' => 'ok']);
    }
}

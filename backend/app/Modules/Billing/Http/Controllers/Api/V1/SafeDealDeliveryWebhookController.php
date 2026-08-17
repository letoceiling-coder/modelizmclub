<?php

namespace Modules\Billing\Http\Controllers\Api\V1;

use App\Enums\SafeDealStatus;
use App\Http\Controllers\Controller;
use App\Models\SafeDeal;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Modules\Billing\Services\SafeDealService;

/**
 * Delivery provider webhook (spec v4.0 §T5): when a parcel is delivered we
 * flip the safe deal to `delivered` and start the auto-release timer.
 */
class SafeDealDeliveryWebhookController extends Controller
{
    public function __invoke(Request $request, SafeDealService $deals): JsonResponse
    {
        $tracking = (string) $request->input('tracking_number', '');
        $status = (string) $request->input('status', '');

        if ($tracking === '') {
            Log::warning('Safe deal delivery webhook without tracking number', $request->all());

            return response()->json(['status' => 'ignored'], 202);
        }

        $deal = SafeDeal::query()
            ->where('tracking_number', $tracking)
            ->whereIn('status', [SafeDealStatus::Paid->value, SafeDealStatus::Shipped->value])
            ->first();

        if (! $deal) {
            return response()->json(['status' => 'not_found'], 202);
        }

        if (in_array(strtolower($status), ['delivered', 'received', 'completed'], true)) {
            $deals->markDelivered($deal, null, "Провайдер доставки: {$status}");
        }

        return response()->json(['status' => 'ok']);
    }
}

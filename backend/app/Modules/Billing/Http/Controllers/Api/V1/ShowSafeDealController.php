<?php

namespace Modules\Billing\Http\Controllers\Api\V1;

use App\Enums\SafeDealStatus;
use App\Http\Controllers\Controller;
use App\Models\SafeDeal;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Billing\Services\SafeDealHoldSyncService;
use Modules\Billing\Services\SafeDealService;
use Throwable;

class ShowSafeDealController extends Controller
{
    public function __invoke(Request $request, string $uuid, SafeDealService $deals, SafeDealHoldSyncService $holds): JsonResponse
    {
        $deal = SafeDeal::query()->with(['listing', 'dispute', 'shipment', 'reviews'])->where('uuid', $uuid)->firstOrFail();
        $user = $request->user();

        if (! $deal->involves($user) && ! $user->isModerator()) {
            abort(403);
        }

        // The buyer usually lands here straight from the VTB form, before the
        // callback arrives — ask the bank so the page is never stale.
        if ($deal->status === SafeDealStatus::Created) {
            $incoming = $deal->activeIncomingPayment();
            if ($incoming !== null) {
                try {
                    $holds->sync($incoming);
                    $deal = $deal->fresh(['listing', 'dispute', 'shipment', 'reviews']) ?? $deal;
                } catch (Throwable) {
                    // Fall through with the stored state; the webhook will retry.
                }
            }
        }

        $payload = $deals->toArray($deal, $user);
        if ($deal->dispute) {
            $payload['dispute'] = [
                'uuid' => $deal->dispute->uuid,
                'status' => $deal->dispute->status->value,
                'reason' => $deal->dispute->reason,
                'evidence' => $deal->dispute->evidence ?? [],
            ];
        }

        return response()->json(['data' => $payload]);
    }
}

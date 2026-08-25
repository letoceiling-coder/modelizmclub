<?php

namespace Modules\Billing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SafeDeal;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Billing\Services\SafeDealService;

class ShowSafeDealController extends Controller
{
    public function __invoke(Request $request, string $uuid, SafeDealService $deals): JsonResponse
    {
        $deal = SafeDeal::query()->with(['listing', 'dispute', 'shipment', 'reviews'])->where('uuid', $uuid)->firstOrFail();
        $user = $request->user();

        if (! $deal->involves($user) && ! $user->isModerator()) {
            abort(403);
        }

        $payload = $deals->toArray($deal, $user);
        if ($deal->dispute) {
            $payload['dispute'] = [
                'uuid' => $deal->dispute->uuid,
                'status' => $deal->dispute->status->value,
                'reason' => $deal->dispute->reason,
            ];
        }

        return response()->json(['data' => $payload]);
    }
}

<?php

namespace Modules\Billing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SubscriptionPlan;
use Illuminate\Http\JsonResponse;
use Modules\Billing\Http\Resources\SubscriptionPlanResource;

class IndexPlansController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $plans = SubscriptionPlan::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('price_cents')
            ->get();

        return response()->json([
            'data' => SubscriptionPlanResource::collection($plans),
        ]);
    }
}

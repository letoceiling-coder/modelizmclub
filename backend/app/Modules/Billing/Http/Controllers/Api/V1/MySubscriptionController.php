<?php

namespace Modules\Billing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\UserSubscription;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Billing\Http\Resources\SubscriptionResource;

#[Group('Billing', weight: 30)]
class MySubscriptionController extends Controller
{
    /**
     * Текущая подписка пользователя. Возвращает активную подписку с планом
     * либо data=null, если пользователь на бесплатном тарифе.
     */
    public function __invoke(Request $request): JsonResponse
    {
        $subscription = UserSubscription::query()
            ->with('plan')
            ->where('user_id', $request->user()->id)
            ->orderByRaw("CASE WHEN status = 'active' THEN 0 ELSE 1 END")
            ->orderByDesc('ends_at')
            ->orderByDesc('id')
            ->first();

        if (! $subscription) {
            return response()->json(['data' => null]);
        }

        return SubscriptionResource::make($subscription)->response();
    }
}

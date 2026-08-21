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
        $user = $request->user();
        if ($user->is_first_hundred) {
            app(\Modules\Billing\Services\FirstHundredService::class)->syncUser($user);
            $user->refresh();
        }

        if (! $user->hasActiveSubscription()) {
            return response()->json(['data' => null]);
        }

        $subscription = UserSubscription::query()
            ->with('plan')
            ->where('user_id', $user->id)
            ->where('status', 'active')
            ->where(function ($q): void {
                $q->whereNull('ends_at')->orWhere('ends_at', '>', now());
            })
            ->orderByDesc('ends_at')
            ->orderByDesc('id')
            ->first();

        if (! $subscription) {
            return response()->json(['data' => null]);
        }

        return SubscriptionResource::make($subscription)->response();
    }
}

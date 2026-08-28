<?php

namespace Modules\Billing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\UserSubscription;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Billing\Http\Resources\SubscriptionResource;

#[Group('Billing', weight: 30)]
class CancelSubscriptionController extends Controller
{
    /**
     * Отмена автопродления. Подписка продолжает действовать до конца
     * оплаченного периода — оставшиеся дни не сгорают.
     */
    public function __invoke(Request $request): JsonResponse
    {
        $subscription = UserSubscription::query()
            ->with('plan')
            ->where('user_id', $request->user()->id)
            ->where('status', 'active')
            ->where(function ($q): void {
                $q->whereNull('ends_at')->orWhere('ends_at', '>', now());
            })
            ->orderByDesc('ends_at')
            ->orderByDesc('id')
            ->first();

        if (! $subscription) {
            return response()->json(['message' => 'Активная подписка не найдена.'], 404);
        }

        if ($subscription->auto_renew || $subscription->cancelled_at === null) {
            $subscription->update([
                'auto_renew' => false,
                'cancelled_at' => now(),
            ]);
        }

        return SubscriptionResource::make($subscription->fresh('plan'))->response();
    }
}

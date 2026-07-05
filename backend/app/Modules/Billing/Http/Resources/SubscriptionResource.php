<?php

namespace Modules\Billing\Http\Resources;

use App\Models\UserSubscription;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin UserSubscription */
class SubscriptionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'status' => $this->status,
            'starts_at' => $this->starts_at?->toIso8601String(),
            'ends_at' => $this->ends_at?->toIso8601String(),
            'auto_renew' => (bool) $this->auto_renew,
            'is_active' => $this->status === 'active'
                && ($this->ends_at === null || $this->ends_at->isFuture()),
            'days_left' => $this->ends_at ? max(0, now()->diffInDays($this->ends_at, false)) : null,
            'plan' => $this->whenLoaded('plan', fn () => $this->plan
                ? new SubscriptionPlanResource($this->plan)
                : null),
        ];
    }
}

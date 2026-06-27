<?php

namespace Modules\Billing\Http\Resources;

use App\Models\SubscriptionPlan;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin SubscriptionPlan */
class SubscriptionPlanResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'name' => $this->name,
            'description' => $this->description,
            'price_cents' => $this->price_cents,
            'price_rub' => round($this->price_cents / 100, 2),
            'period_days' => $this->period_days,
            'features' => $this->features ?? [],
            'badge_label' => $this->badge_label,
            'sort_order' => $this->sort_order,
        ];
    }
}

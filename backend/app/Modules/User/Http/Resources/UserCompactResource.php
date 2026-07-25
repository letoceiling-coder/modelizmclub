<?php

namespace Modules\User\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin User */
class UserCompactResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'display_name' => $this->profile?->display_name,
            'slug' => $this->profile?->slug,
            'avatar' => $this->when(
                $this->relationLoaded('profile') && $this->profile?->relationLoaded('avatar'),
                fn () => $this->profile?->avatar ? [
                    'uuid' => $this->profile->avatar->uuid,
                    'url' => $this->profile->avatar->url ?? null,
                ] : null,
            ),
            'city' => $this->when(
                $this->relationLoaded('profile') && $this->profile?->relationLoaded('city'),
                fn () => $this->profile?->city ? [
                    'id' => $this->profile->city->id,
                    'name' => $this->profile->city->name,
                    'slug' => $this->profile->city->slug,
                ] : null,
            ),
            'last_seen_at' => $this->last_seen_at?->toIso8601String(),
        ];
    }
}

<?php

namespace Modules\User\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\User */
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
        ];
    }
}

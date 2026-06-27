<?php

namespace Modules\Auth\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin User */
class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'uuid' => $this->uuid,
            'email' => $this->email,
            'name' => $this->name,
            'role' => $this->role?->value ?? $this->role,
            'status' => $this->status?->value ?? $this->status,
            'registration_track' => $this->registration_track?->value,
            'locale' => $this->locale,
            'email_verified_at' => $this->email_verified_at?->toIso8601String(),
            'last_seen_at' => $this->last_seen_at?->toIso8601String(),
            'profile' => $this->whenLoaded('profile', fn () => [
                'display_name' => $this->profile->display_name,
                'slug' => $this->profile->slug,
                'bio' => $this->profile->bio,
            ]),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}

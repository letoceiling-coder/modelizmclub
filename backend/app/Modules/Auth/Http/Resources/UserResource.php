<?php

namespace Modules\Auth\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\User\Http\Resources\PostCategoryResource;

/** @mixin User */
class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'email' => $this->displayEmail(),
            'name' => $this->name,
            'role' => $this->role?->value ?? $this->role,
            'status' => $this->status?->value ?? $this->status,
            'registration_track' => $this->registration_track?->value,
            'locale' => $this->locale,
            'email_verified_at' => $this->email_verified_at?->toIso8601String(),
            'email_verified' => ! $this->requiresEmailVerification(),
            'oauth_providers' => $this->oauthProviderNames(),
            'phone' => $this->phone,
            'phone_verified_at' => $this->phone_verified_at?->toIso8601String(),
            'phone_verified' => $this->phone_verified_at !== null,
            'is_first_hundred' => (bool) $this->is_first_hundred,
            'listing_placement_credits' => (int) ($this->listing_placement_credits ?? 0),
            'last_seen_at' => $this->last_seen_at?->toIso8601String(),
            'profile' => $this->whenLoaded('profile', function () {
                $profile = $this->profile;

                return [
                    'display_name' => $profile->display_name,
                    'slug' => $profile->slug,
                    'bio' => $profile->bio,
                    'city_id' => $profile->city_id,
                    'vk_url' => $profile->vk_url,
                    'telegram_url' => $profile->telegram_url,
                    'website_url' => $profile->website_url,
                    'city' => $profile->relationLoaded('city') && $profile->city ? [
                        'id' => $profile->city->id,
                        'name' => $profile->city->name,
                        'slug' => $profile->city->slug,
                    ] : null,
                    'avatar' => $profile->relationLoaded('avatar') && $profile->avatar ? [
                        'uuid' => $profile->avatar->uuid,
                        'url' => $profile->avatar->url ?? null,
                    ] : null,
                    'cover' => $profile->relationLoaded('cover') && $profile->cover ? [
                        'uuid' => $profile->cover->uuid,
                        'url' => $profile->cover->url ?? null,
                    ] : null,
                ];
            }),
            'interests' => PostCategoryResource::collection($this->whenLoaded('interests')),
            'subscription' => $this->when($this->relationLoaded('subscriptions'), fn () => $this->subscriptionSummary()),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }

    /** Latest subscription row, flattened for the admin user list. */
    private function subscriptionSummary(): ?array
    {
        $sub = $this->subscriptions->sortByDesc('ends_at')->sortByDesc('id')->first();
        if (! $sub) {
            return null;
        }

        $active = $sub->status === 'active' && ($sub->ends_at === null || $sub->ends_at->isFuture());
        $expired = $sub->status === 'active' && $sub->ends_at !== null && $sub->ends_at->isPast();

        return [
            'status' => $expired ? 'expired' : ($active ? 'active' : $sub->status),
            'is_active' => $active,
            'ends_at' => $sub->ends_at?->toIso8601String(),
            'auto_renew' => (bool) $sub->auto_renew,
        ];
    }
}

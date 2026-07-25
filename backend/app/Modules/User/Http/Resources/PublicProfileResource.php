<?php

namespace Modules\User\Http\Resources;

use App\Models\UserProfile;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin UserProfile */
class PublicProfileResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $privacy = array_merge(
            UserProfile::DEFAULT_PRIVACY,
            $this->privacy_settings ?? [],
        );

        $viewer = $request->user();
        $isOwner = $viewer && $viewer->id === $this->user_id;

        return [
            'id' => $this->user_id,
            'uuid' => $this->user?->uuid,
            'display_name' => $this->display_name,
            'slug' => $this->slug,
            'bio' => $this->bio,
            'city' => $this->whenLoaded('city', fn () => $this->city ? [
                'id' => $this->city->id,
                'name' => $this->city->name,
                'slug' => $this->city->slug,
            ] : null),
            'avatar' => $this->whenLoaded('avatar', fn () => $this->avatar ? [
                'uuid' => $this->avatar->uuid,
                'url' => $this->avatar->url ?? null,
            ] : null),
            'cover' => $this->whenLoaded('cover', fn () => $this->cover ? [
                'uuid' => $this->cover->uuid,
                'url' => $this->cover->url ?? null,
            ] : null),
            'stats' => [
                'publications_count' => $this->publications_count,
                'followers_count' => $this->followers_count,
                'following_count' => $this->following_count,
                'rating_score' => (float) $this->rating_score,
            ],
            'member_since' => $this->user?->created_at?->toIso8601String(),
            'is_following' => $this->when(
                $this->getAttribute('is_following') !== null,
                (bool) $this->getAttribute('is_following'),
            ),
            'is_friend' => $this->when(
                $this->getAttribute('is_friend') !== null,
                (bool) $this->getAttribute('is_friend'),
            ),
            'friend_request_status' => $this->when(
                $this->getAttribute('friend_request_status') !== null,
                $this->getAttribute('friend_request_status'),
            ),
            'permissions' => [
                'can_view_email' => $isOwner || ($privacy['show_email'] ?? false),
            ],
            'phone' => $this->when($isOwner, $this->user?->phone),
            'vk_url' => $this->vk_url,
            'telegram_url' => $this->telegram_url,
            'website_url' => $this->website_url,
        ];
    }
}

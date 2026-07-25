<?php

namespace Modules\Channel\Http\Resources;

use App\Models\Channel;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Feed\Services\PostService;
use Modules\User\Http\Resources\UserCompactResource;

/** @mixin Channel */
class ChannelResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $viewer = $request->user('sanctum');

        return [
            'id' => $this->uuid,
            'name' => $this->name,
            'slug' => $this->slug,
            'description' => $this->description ?? '',
            'category' => $this->category ?? '',
            'kind' => $this->kind,
            'avatar_color' => $this->avatar_color,
            'banner_color' => $this->banner_color,
            'avatar' => $this->whenLoaded('avatar', fn () => $this->avatar ? [
                'uuid' => $this->avatar->uuid,
                'url' => $this->avatar->url,
            ] : null),
            'banner' => $this->whenLoaded('banner', fn () => $this->banner ? [
                'uuid' => $this->banner->uuid,
                'url' => $this->banner->url,
            ] : null),
            'subscribers' => $this->subscribers_count,
            'created_at' => $this->created_at?->toIso8601String(),
            'owner_name' => $this->owner?->profile?->display_name ?? $this->owner?->name ?? '',
            'owner' => $this->whenLoaded('owner', fn () => new UserCompactResource($this->owner)),
            'is_owner' => $this->isOwnedBy($viewer),
            'is_subscribed' => $this->is_subscribed,
            'posts_require_moderation' => app(PostService::class)->autoPublishEnabled() === false,
        ];
    }
}

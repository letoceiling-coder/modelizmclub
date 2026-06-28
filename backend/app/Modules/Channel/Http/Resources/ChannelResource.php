<?php

namespace Modules\Channel\Http\Resources;

use App\Models\Channel;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Channel */
class ChannelResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $viewer = $request->user();

        return [
            'id' => $this->uuid,
            'name' => $this->name,
            'slug' => $this->slug,
            'description' => $this->description ?? '',
            'category' => $this->category ?? '',
            'kind' => $this->kind,
            'avatar_color' => $this->avatar_color,
            'banner_color' => $this->banner_color,
            'subscribers' => $this->subscribers_count,
            'created_at' => $this->created_at?->toIso8601String(),
            'owner_name' => $this->owner?->profile?->display_name ?? $this->owner?->name ?? '',
            'is_owner' => $viewer !== null && $this->owner_id === $viewer->id,
            'is_subscribed' => $this->is_subscribed,
        ];
    }
}

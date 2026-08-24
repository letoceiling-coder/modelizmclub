<?php

namespace Modules\Channel\Http\Resources;

use App\Models\ChannelPost;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin ChannelPost */
class ChannelPostResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $viewer = $request->user();
        $isOwner = $viewer !== null && $this->author_id === $viewer->id;

        return [
            'id' => $this->uuid,
            'channel_id' => $this->whenLoaded('channel', fn () => $this->channel->uuid),
            'author_name' => $this->author?->profile?->display_name ?? $this->author?->name ?? '',
            'text' => $this->text,
            'kind' => $this->kind,
            'status' => $this->status,
            'rejection_reason' => $this->when(
                $isOwner && $this->status === 'rejected',
                $this->rejection_reason,
            ),
            'likes' => $this->likes_count,
            'views' => $this->views_count,
            'liked' => (bool) $this->viewer_liked,
            'pinned' => $this->pinned_at !== null,
            'feed_post_uuid' => $this->whenLoaded('feedPost', fn () => $this->feedPost?->uuid),
            'media' => ChannelPostMediaResource::collection($this->whenLoaded('media')),
            'created_at' => ($this->published_at ?? $this->created_at)?->toIso8601String(),
        ];
    }
}

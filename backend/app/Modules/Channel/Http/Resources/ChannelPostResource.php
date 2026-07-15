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
        return [
            'id' => $this->uuid,
            'channel_id' => $this->whenLoaded('channel', fn () => $this->channel->uuid),
            'author_name' => $this->author?->profile?->display_name ?? $this->author?->name ?? '',
            'text' => $this->text,
            'kind' => $this->kind,
            'status' => $this->status,
            'likes' => $this->likes_count,
            'views' => $this->views_count,
            'media' => ChannelPostMediaResource::collection($this->whenLoaded('media')),
            'created_at' => ($this->published_at ?? $this->created_at)?->toIso8601String(),
        ];
    }
}

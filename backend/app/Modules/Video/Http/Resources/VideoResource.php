<?php

namespace Modules\Video\Http\Resources;

use App\Models\Video;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Video */
class VideoResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'uuid' => $this->uuid,
            'title' => $this->title,
            'description' => $this->description,
            'category' => $this->whenLoaded('category', fn () => $this->category ? [
                'id' => $this->category->uuid,
                'slug' => $this->category->slug,
            ] : null),
            'poster_url' => $this->poster?->url,
            'video_url' => $this->videoMedia?->url,
            'duration_seconds' => $this->duration_seconds,
            'views_count' => $this->views_count,
            'is_featured' => $this->is_featured,
            'tags' => $this->tags ?? [],
            'published_at' => $this->published_at?->toIso8601String(),
            'uploader' => $this->whenLoaded('uploader', fn () => ['uuid' => $this->uploader?->uuid]),
            'status' => $this->status,
            'likes_count' => $this->likes_count,
            'comments_count' => $this->comments_count,
            'is_liked' => (bool) $this->getAttribute('is_liked'),
        ];
    }
}

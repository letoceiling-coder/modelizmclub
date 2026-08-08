<?php

namespace Modules\Video\Http\Resources;

use App\Models\Video;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\User\Http\Resources\UserCompactResource;

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
                'title' => $this->category->title,
            ] : null),
            'poster_url' => $this->poster?->url,
            'video_url' => $this->videoMedia?->url,
            'video_mime_type' => $this->videoMedia?->mime_type,
            'duration_seconds' => $this->duration_seconds > 0
                ? $this->duration_seconds
                : (int) ($this->videoMedia?->duration_seconds ?? 0),
            'views_count' => $this->views_count,
            'is_featured' => $this->is_featured,
            'tags' => $this->tags ?? [],
            'published_at' => $this->published_at?->toIso8601String(),
            'scheduled_at' => $this->scheduled_at?->toIso8601String(),
            'uploader' => $this->whenLoaded('uploader', fn () => $this->uploader
                ? new UserCompactResource($this->uploader)
                : null),
            'status' => $this->status,
            'likes_count' => $this->likes_count,
            'dislikes_count' => $this->dislikes_count ?? 0,
            'comments_count' => $this->comments_count,
            'is_liked' => (bool) $this->getAttribute('is_liked'),
            'is_disliked' => (bool) $this->getAttribute('is_disliked'),
        ];
    }
}

<?php

namespace Modules\Chat\Http\Resources;

use App\Models\Post;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Str;

/** @mixin Post */
class PostCompactResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $preview = null;
        if ($this->relationLoaded('mediaItems')) {
            $preview = $this->mediaItems->first()?->media?->url;
        }

        return [
            'uuid' => $this->uuid,
            'title' => $this->title,
            'excerpt' => $this->body ? Str::limit(strip_tags($this->body), 120) : null,
            'image' => $preview,
            'preview' => $preview,
            'author_name' => $this->whenLoaded('author', fn () => $this->author?->profile?->display_name ?? $this->author?->name),
        ];
    }
}

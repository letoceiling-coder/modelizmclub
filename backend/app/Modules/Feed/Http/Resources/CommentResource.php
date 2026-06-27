<?php

namespace Modules\Feed\Http\Resources;

use App\Models\Comment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\User\Http\Resources\UserCompactResource;

/** @mixin Comment */
class CommentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'uuid' => $this->uuid,
            'body' => $this->body,
            'depth' => $this->depth,
            'author' => new UserCompactResource($this->whenLoaded('author')),
            'parent_uuid' => $this->whenLoaded('parent', fn () => $this->parent?->uuid),
            'stats' => [
                'reactions' => $this->reactions_count,
            ],
            'replies' => self::collection($this->whenLoaded('replies')),
            'created_at' => $this->created_at->toIso8601String(),
        ];
    }
}

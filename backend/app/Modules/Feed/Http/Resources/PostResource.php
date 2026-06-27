<?php

namespace Modules\Feed\Http\Resources;

use App\Models\Post;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\User\Http\Resources\UserCompactResource;

/** @mixin Post */
class PostResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $user = $request->user();

        return [
            'uuid' => $this->uuid,
            'title' => $this->title,
            'body' => $this->body,
            'status' => $this->status->value,
            'author' => new UserCompactResource($this->whenLoaded('author')),
            'category' => $this->whenLoaded('category', fn () => [
                'id' => $this->category->id,
                'name' => $this->category->name,
                'slug' => $this->category->slug,
            ]),
            'community' => $this->whenLoaded('community', fn () => $this->community ? [
                'slug' => $this->community->slug,
                'name' => $this->community->name,
            ] : null),
            'media' => PostMediaResource::collection($this->whenLoaded('mediaItems')),
            'hashtags' => $this->whenLoaded('tags', fn () => $this->tags->pluck('name')),
            'repost_of' => $this->whenLoaded('repostOf', fn () => $this->repostOf ? [
                'uuid' => $this->repostOf->uuid,
                'title' => $this->repostOf->title,
                'author' => new UserCompactResource($this->repostOf->author),
            ] : null),
            'stats' => [
                'views' => $this->views_count,
                'reactions' => $this->reactions_count,
                'comments' => $this->comments_count,
            ],
            'viewer' => [
                'reacted' => $this->viewer_reacted,
                'bookmarked' => $this->viewer_bookmarked,
            ],
            'permissions' => [
                'can_edit' => $user ? $user->can('update', $this->resource) : false,
                'can_publish' => $user ? $user->can('publish', $this->resource) : false,
                'can_delete' => $user ? $user->can('delete', $this->resource) : false,
            ],
            'published_at' => $this->published_at?->toIso8601String(),
            'created_at' => $this->created_at->toIso8601String(),
            'updated_at' => $this->updated_at->toIso8601String(),
        ];
    }
}

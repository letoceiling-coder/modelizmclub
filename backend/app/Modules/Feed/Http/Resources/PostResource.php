<?php

namespace Modules\Feed\Http\Resources;

use App\Models\Post;
use App\Http\Resources\Concerns\HasCanFlags;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\User\Http\Resources\UserCompactResource;

/** @mixin Post */
class PostResource extends JsonResource
{
    use HasCanFlags;

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
            'channel' => $this->when(
                $this->relationLoaded('channelPost') && $this->channelPost?->relationLoaded('channel') && $this->channelPost->channel,
                fn () => [
                    'id' => $this->channelPost->channel->uuid,
                    'slug' => $this->channelPost->channel->slug,
                    'name' => $this->channelPost->channel->name,
                    'kind' => $this->channelPost->channel->kind,
                    'avatar' => $this->channelPost->channel->relationLoaded('avatar') && $this->channelPost->channel->avatar
                        ? [
                            'uuid' => $this->channelPost->channel->avatar->uuid,
                            'url' => $this->channelPost->channel->avatar->url,
                        ]
                        : null,
                    'is_subscribed' => (bool) $this->channelPost->channel->is_subscribed,
                    'comments_enabled' => (bool) $this->channelPost->channel->comments_enabled,
                ],
            ),
            'media' => PostMediaResource::collection($this->whenLoaded('mediaItems')),
            'hashtags' => $this->whenLoaded('tags', fn () => $this->tags->pluck('name')),
            'repost_of' => $this->whenLoaded('repostOf', fn () => $this->repostOf ? [
                'uuid' => $this->repostOf->uuid,
                'title' => $this->repostOf->title,
                'body' => $this->repostOf->body,
                'category' => $this->repostOf->category?->name,
                'author' => new UserCompactResource($this->repostOf->author),
                'media' => $this->repostOf->relationLoaded('mediaItems')
                    ? PostMediaResource::collection($this->repostOf->mediaItems)
                    : [],
                'hashtags' => $this->repostOf->relationLoaded('tags')
                    ? $this->repostOf->tags->pluck('name')
                    : [],
                'stats' => [
                    'views' => $this->repostOf->views_count,
                    'reactions' => $this->repostOf->reactions_count,
                    'comments' => $this->repostOf->comments_count,
                    'reposts' => $this->repostOf->reposts_total,
                ],
                'viewer' => [
                    'reacted' => $this->repostOf->viewer_reacted,
                    'bookmarked' => $this->repostOf->viewer_bookmarked,
                    'reposted' => $this->repostOf->viewer_reposted,
                ],
                'published_at' => $this->repostOf->published_at?->toIso8601String(),
            ] : null),
            'stats' => [
                'views' => $this->views_count,
                'reactions' => $this->reactions_count,
                'comments' => $this->comments_count,
                'reposts' => $this->reposts_total,
            ],
            'viewer' => [
                'reacted' => $this->viewer_reacted,
                'bookmarked' => $this->viewer_bookmarked,
                'reposted' => $this->viewer_reposted,
            ],
            'can' => $this->canFlags($user, ['edit' => 'update', 'delete', 'react', 'comment']),
            'permissions' => [
                'can_edit' => $user ? $user->can('update', $this->resource) : false,
                'can_publish' => $user ? $user->can('publish', $this->resource) : false,
                'can_delete' => $user ? $user->can('delete', $this->resource) : false,
                'can_cancel_schedule' => $user
                    && $this->status === \App\Enums\ContentStatus::Scheduled
                    && $this->user_id === $user->id,
                'can_interact' => $this->resource->allowsPublicInteractions(),
            ],
            'published_at' => $this->published_at?->toIso8601String(),
            'scheduled_at' => $this->scheduled_at?->toIso8601String(),
            'created_at' => $this->created_at->toIso8601String(),
            'updated_at' => $this->updated_at->toIso8601String(),
        ];
    }
}

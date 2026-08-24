<?php

namespace Modules\Community\Http\Resources;

use App\Models\Community;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Community */
class CommunityResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $user = $request->user('sanctum');

        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'name' => $this->name,
            'slug' => $this->slug,
            'description' => $this->description,
            'rules' => $this->rules,
            'is_official' => $this->is_official,
            'access_type' => $this->access_type ?? 'open',
            'custom_category' => $this->custom_category,
            'contacts' => $this->contacts,
            'members_count' => (int) ($this->live_members_count ?? $this->members_count),
            'posts_count' => $this->posts_count,
            'category' => $this->whenLoaded('category', fn () => [
                'id' => $this->category->id,
                'name' => $this->category->name,
                'slug' => $this->category->slug,
            ]),
            'city' => $this->whenLoaded('city', fn () => $this->city ? [
                'id' => $this->city->id,
                'name' => $this->city->name,
            ] : null),
            'topics' => $this->whenLoaded('topicCategories', fn () => $this->topicCategories->map(fn ($c) => [
                'id' => $c->id,
                'name' => $c->name,
                'slug' => $c->slug,
            ])->values()),
            'avatar' => $this->whenLoaded('avatar', fn () => $this->avatar ? [
                'uuid' => $this->avatar->uuid,
                'url' => $this->avatar->url,
            ] : null),
            'cover' => $this->whenLoaded('cover', fn () => $this->cover ? [
                'uuid' => $this->cover->uuid,
                'url' => $this->cover->url,
            ] : null),
            'subcategories' => $this->whenLoaded('subcategories', fn () => $this->subcategories->map(fn ($s) => [
                'id' => $s->id,
                'name' => $s->name,
                'slug' => $s->slug,
                'sort_order' => $s->sort_order,
            ])),
            'is_member' => $this->when(
                $this->getAttribute('is_member') !== null,
                (bool) $this->getAttribute('is_member'),
            ),
            'is_owner' => $user !== null && $this->isOwnedBy($user),
            'can_manage' => $user !== null && $this->canManage($user),
            'viewer_role' => $this->getAttribute('viewer_role'),
            'unread_posts' => $this->when($this->getAttribute('unread_posts') !== null, (int) $this->getAttribute('unread_posts')),
            'unread_messages' => $this->when($this->getAttribute('unread_messages') !== null, (int) $this->getAttribute('unread_messages')),
            'online_avatars' => $this->when($this->getAttribute('online_avatars') !== null, $this->getAttribute('online_avatars')),
            'join_request_pending' => $this->when(
                $this->getAttribute('join_request_pending') !== null,
                (bool) $this->getAttribute('join_request_pending'),
            ),
            'approved_at' => $this->approved_at?->toIso8601String(),
        ];
    }
}

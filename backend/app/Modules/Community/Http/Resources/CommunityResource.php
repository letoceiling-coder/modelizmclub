<?php

namespace Modules\Community\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Community */
class CommunityResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'name' => $this->name,
            'slug' => $this->slug,
            'description' => $this->description,
            'is_official' => $this->is_official,
            'members_count' => $this->members_count,
            'posts_count' => $this->posts_count,
            'category' => $this->whenLoaded('category', fn () => [
                'id' => $this->category->id,
                'name' => $this->category->name,
                'slug' => $this->category->slug,
            ]),
            'avatar' => $this->whenLoaded('avatar', fn () => $this->avatar ? [
                'uuid' => $this->avatar->uuid,
            ] : null),
            'cover' => $this->whenLoaded('cover', fn () => $this->cover ? [
                'uuid' => $this->cover->uuid,
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
            'approved_at' => $this->approved_at?->toIso8601String(),
        ];
    }
}

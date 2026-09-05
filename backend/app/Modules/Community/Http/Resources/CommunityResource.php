<?php

namespace Modules\Community\Http\Resources;

use App\Enums\CommunityMemberRole;
use App\Models\Community;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Gate;

/** @mixin Community */
class CommunityResource extends JsonResource
{
    /**
     * Владелец сообщества.
     *
     * Создатель, а если его нет (сообщество завели миграцией или он удалён) —
     * участник с ролью owner. Без этого блока страница не могла показать,
     * с кем вообще имеет дело.
     *
     * @return array{uuid: string, name: string, slug: string|null, avatar: string|null}|null
     */
    private function owner(): ?array
    {
        $owner = $this->relationLoaded('creator') ? $this->creator : null;

        // Запасной путь — для сообществ без created_by: их заводили до того,
        // как поле появилось. Один запрос на одно сообщество, и только когда
        // создателя действительно нет.
        if ($owner === null && $this->created_by === null) {
            $owner = $this->members()
                ->wherePivot('role', CommunityMemberRole::Owner->value)
                ->with('profile.avatar')
                ->first();
        }

        if ($owner === null) {
            return null;
        }

        return [
            'uuid' => $owner->uuid,
            'name' => $owner->profile?->display_name ?? $owner->name,
            'slug' => $owner->profile?->slug,
            'avatar' => $owner->profile?->avatar?->url,
        ];
    }

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
            'created_at' => $this->created_at?->toIso8601String(),
            'owner' => $this->owner(),
            // Что смотрящий может сделать. Считает та же политика, что
            // охраняет маршруты: иначе кнопка на экране и запрет за ней
            // рано или поздно разойдутся.
            'can' => [
                'join' => $user !== null && Gate::forUser($user)->allows('join', $this->resource),
                'leave' => $user !== null && Gate::forUser($user)->allows('leave', $this->resource),
                'manage' => $user !== null && Gate::forUser($user)->allows('manage', $this->resource),
                'post' => $user !== null && Gate::forUser($user)->allows('post', $this->resource),
                'invite' => $user !== null && Gate::forUser($user)->allows('invite', $this->resource),
            ],
            // Оба поля кладёт в атрибуты запрос, который собрал страницу:
            // спрашивать их здесь означало бы по два запроса на карточку.
            'is_favorite' => $this->when(
                $this->getAttribute('is_favorite') !== null,
                (bool) $this->getAttribute('is_favorite'),
            ),
            'notifications_enabled' => $this->when(
                $this->getAttribute('notifications_enabled') !== null,
                (bool) $this->getAttribute('notifications_enabled'),
            ),
        ];
    }
}

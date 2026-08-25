<?php

namespace Modules\Community\Services;

use App\Enums\CommunityApplicationStatus;
use App\Enums\CommunityMemberRole;
use App\Enums\CommunityStatus;
use App\Models\Community;
use App\Models\ModerationQueue;
use App\Models\CommunityApplication;
use App\Models\CommunityCategory;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Modules\Catalog\Services\CategoryTaxonomyService;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class CommunityService
{
    public function list(array $filters = [], int $perPage = 20, ?User $viewer = null): LengthAwarePaginator
    {
        $query = Community::query()
            ->active()
            ->withCount(['members as live_members_count'])
            ->with(['category', 'avatar', 'cover', 'city', 'topicCategories'])
            ->when(! empty($filters['taxonomy_id']), function ($q) use ($filters): void {
                $ids = app(CategoryTaxonomyService::class)->communityIdsForPostCategory((int) $filters['taxonomy_id']);
                if ($ids === []) {
                    $q->whereRaw('1 = 0');

                    return;
                }
                $q->whereIn('category_id', $ids);
            })
            ->when(empty($filters['taxonomy_id']) && ($filters['category_id'] ?? null), fn ($q, $id) => $q->where('category_id', $id))
            ->when($filters['q'] ?? null, function ($q, $term): void {
                $q->where(function ($q) use ($term): void {
                    $q->where('name', 'ilike', "%{$term}%")
                        ->orWhere('description', 'ilike', "%{$term}%");
                });
            })
            ->when(isset($filters['official']), fn ($q) => $q->where('is_official', (bool) $filters['official']))
            ->when(($filters['owned'] ?? false) && $viewer, function ($q) use ($viewer): void {
                $q->where(function ($q) use ($viewer): void {
                    $q->where('created_by', $viewer->id)
                        ->orWhereHas('members', function ($q) use ($viewer): void {
                            $q->where('users.id', $viewer->id)
                                ->where('community_members.role', CommunityMemberRole::Owner->value);
                        });
                });
            });

        // Варианты сортировки: popular (участники), newest, name; по умолчанию — официальные и крупные вперёд.
        match ($filters['sort'] ?? null) {
            'popular' => $query->orderByDesc('members_count')->orderBy('name'),
            'newest' => $query->orderByDesc('id'),
            'name' => $query->orderBy('name'),
            default => $query->orderByDesc('is_official')->orderByDesc('members_count')->orderBy('name'),
        };

        $paginator = $query->paginate($perPage);

        if ($viewer) {
            $ids = $paginator->getCollection()->pluck('id');
            $roles = DB::table('community_members')
                ->where('user_id', $viewer->id)
                ->whereIn('community_id', $ids)
                ->pluck('role', 'community_id')
                ->all();
            $paginator->getCollection()->each(function (Community $c) use ($roles, $viewer): void {
                $role = $roles[$c->id] ?? null;
                if ((int) $c->created_by === (int) $viewer->id) {
                    $role = CommunityMemberRole::Owner->value;
                }
                $c->setAttribute('is_member', $role !== null);
                $c->setAttribute('viewer_role', $role);
            });
            app(CommunityHubService::class)->attachActivity($paginator->getCollection(), $viewer);
        }

        return $paginator;
    }

    public function show(string $slug, ?User $viewer = null): Community
    {
        $community = Community::query()
            ->withCount(['members as live_members_count'])
            ->with(['category', 'avatar', 'cover', 'subcategories', 'city', 'topicCategories'])
            ->where('slug', $slug)
            ->first();

        if (! $community || $community->status !== CommunityStatus::Active) {
            throw new NotFoundHttpException('Сообщество не найдено.');
        }

        if ($viewer) {
            $member = $community->members()->where('users.id', $viewer->id)->first();
            $role = $member?->pivot?->role;
            if ((int) $community->created_by === (int) $viewer->id) {
                $role = CommunityMemberRole::Owner->value;
            }
            $community->setAttribute('is_member', $member !== null || $role !== null);
            $community->setAttribute('viewer_role', $role);
            app(CommunityHubService::class)->attachActivity(collect([$community]), $viewer);
        }

        return $community;
    }

    public function apply(User $user, string $proposedName, ?string $description, int $categoryId, array $payload = []): CommunityApplication
    {
        $categoryId = $this->resolveCategoryId($categoryId);

        $hasPending = CommunityApplication::query()
            ->where('user_id', $user->id)
            ->where('status', CommunityApplicationStatus::Pending)
            ->exists();

        if ($hasPending) {
            throw ValidationException::withMessages([
                'application' => ['У вас уже есть заявка на рассмотрении.'],
            ]);
        }

        return CommunityApplication::create([
            'user_id' => $user->id,
            'proposed_name' => $proposedName,
            'description' => $description,
            'category_id' => $categoryId,
            'payload' => $payload !== [] ? $payload : null,
            'status' => CommunityApplicationStatus::Pending,
        ]);
    }

    /**
     * Approve a pending application: create the Community, make the applicant
     * its owner, and mark the application as reviewed.
     */
    public function approveApplication(CommunityApplication $application, User $reviewer): Community
    {
        $this->assertPendingApplication($application);

        return DB::transaction(function () use ($application, $reviewer): Community {
            $community = Community::create([
                'category_id' => $application->category_id,
                'name' => $application->proposed_name,
                'slug' => self::uniqueSlug($application->proposed_name),
                'description' => $application->description,
                'status' => CommunityStatus::Active,
                'created_by' => $application->user_id,
                'approved_at' => now(),
                'members_count' => 1,
            ]);

            $payload = is_array($application->payload) ? $application->payload : [];
            if ($payload !== []) {
                app(CommunityHubService::class)->hydrateCommunityFromPayload($community, $payload);
            }

            $community->members()->attach($application->user_id, [
                'role' => CommunityMemberRole::Owner->value,
                'joined_at' => now(),
            ]);

            $owner = User::query()->find($application->user_id);
            if ($owner) {
                app(CommunityHubService::class)->addToChat($community, $owner);
            }

            $application->update([
                'status' => CommunityApplicationStatus::Approved,
                'reviewed_by' => $reviewer->id,
                'reviewed_at' => now(),
            ]);

            return $community;
        });
    }

    public function rejectApplication(CommunityApplication $application, User $reviewer, ?string $reason = null): CommunityApplication
    {
        $this->assertPendingApplication($application);

        $application->update([
            'status' => CommunityApplicationStatus::Rejected,
            'moderator_comment' => $reason,
            'reviewed_by' => $reviewer->id,
            'reviewed_at' => now(),
        ]);

        return $application->fresh();
    }

    private function assertPendingApplication(CommunityApplication $application): void
    {
        if ($application->status !== CommunityApplicationStatus::Pending) {
            throw ValidationException::withMessages([
                'application' => ['Заявка уже рассмотрена.'],
            ]);
        }
    }

    public function join(User $user, Community $community, ?string $message = null): array
    {
        $this->assertActiveCommunity($community);

        return app(CommunityHubService::class)->requestOrJoin($community, $user, $message);
    }

    public function leave(User $user, Community $community): void
    {
        $this->assertActiveCommunity($community);

        if ($community->isOwnedBy($user)) {
            throw ValidationException::withMessages([
                'community' => ['Владелец не может покинуть сообщество. Удалите его или передайте права.'],
            ]);
        }

        $detached = $community->members()->detach($user->id);

        if ($detached > 0 && $community->members_count > 0) {
            $community->decrement('members_count');
        }
        app(CommunityHubService::class)->removeFromChat($community, $user);
    }

    public function members(Community $community, int $perPage = 30): LengthAwarePaginator
    {
        $this->assertActiveCommunity($community);

        return $community->members()
            ->with(['profile.avatar', 'profile.city'])
            ->orderByRaw("case community_members.role when 'owner' then 0 when 'moderator' then 1 else 2 end")
            ->orderByDesc('community_members.joined_at')
            ->paginate($perPage);
    }

    /**
     * Удалить сообщество (soft delete). Только владелец.
     *
     * @throws ValidationException
     */
    public function delete(Community $community, User $actor, string $confirmName): void
    {
        if (trim($confirmName) !== $community->name) {
            throw ValidationException::withMessages([
                'confirm_name' => ['Введите точное название сообщества для подтверждения.'],
            ]);
        }

        $community->delete();
    }

    public function findActiveBySlug(string $slug): Community
    {
        $community = Community::query()->where('slug', $slug)->first();

        if (! $community || $community->status !== CommunityStatus::Active) {
            throw new NotFoundHttpException('Сообщество не найдено.');
        }

        return $community;
    }

    public static function uniqueSlug(string $name): string
    {
        $slug = Str::slug($name) ?: 'community';
        $original = $slug;
        $suffix = 1;

        while (Community::withTrashed()->where('slug', $slug)->exists()) {
            $slug = $original.'-'.$suffix;
            $suffix++;
        }

        return $slug;
    }

    private function assertActiveCommunity(Community $community): void
    {
        if ($community->status !== CommunityStatus::Active) {
            throw new NotFoundHttpException('Сообщество недоступно.');
        }
    }

    /** @param array<string, mixed> $changes */
    public function submitRevision(Community $community, array $changes): Community
    {
        $settings = $community->settings ?? [];
        $pending = array_merge($settings['pending_revision'] ?? [], $changes);
        $pending['submitted_at'] = now()->toIso8601String();
        $settings['pending_revision'] = $pending;
        $community->update(['settings' => $settings]);

        ModerationQueue::query()->updateOrCreate(
            [
                'moderatable_type' => Community::class,
                'moderatable_id' => $community->id,
            ],
            [
                'queue' => 'communities',
                'priority' => 0,
                'status' => 'pending',
            ],
        );

        return $community->fresh();
    }

    public function applyPendingRevision(Community $community): void
    {
        $settings = $community->settings ?? [];
        $pending = $settings['pending_revision'] ?? null;
        if (! is_array($pending)) {
            return;
        }

        $updates = array_intersect_key($pending, array_flip([
            'name', 'description', 'category_id', 'avatar_media_id', 'cover_media_id',
            'city_id', 'rules', 'access_type', 'custom_category', 'contacts',
        ]));

        if ($updates !== []) {
            $community->update($updates);
        }

        unset($settings['pending_revision']);
        $community->update(['settings' => $settings]);
    }

    public function resolveCategoryId(?int $categoryId): int
    {
        if ($categoryId && CommunityCategory::query()->whereKey($categoryId)->where('is_active', true)->exists()) {
            return $categoryId;
        }

        $fallback = CommunityCategory::query()->where('is_active', true)->orderBy('id')->value('id');
        if ($fallback) {
            return (int) $fallback;
        }

        $created = CommunityCategory::query()->create([
            'name' => 'Другое',
            'slug' => 'other',
            'sort_order' => 999,
            'depth' => 0,
            'is_active' => true,
        ]);

        return (int) $created->id;
    }
}

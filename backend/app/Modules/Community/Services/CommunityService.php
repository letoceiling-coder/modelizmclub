<?php

namespace Modules\Community\Services;

use App\Enums\CommunityApplicationStatus;
use App\Enums\CommunityMemberRole;
use App\Enums\CommunityStatus;
use App\Models\Community;
use App\Models\CommunityApplication;
use App\Models\CommunityCategory;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class CommunityService
{
    public function list(array $filters = [], int $perPage = 20, ?User $viewer = null): LengthAwarePaginator
    {
        $query = Community::query()
            ->active()
            ->with(['category', 'avatar', 'cover'])
            ->when($filters['category_id'] ?? null, fn ($q, $id) => $q->where('category_id', $id))
            ->when($filters['q'] ?? null, function ($q, $term): void {
                $q->where(function ($q) use ($term): void {
                    $q->where('name', 'ilike', "%{$term}%")
                        ->orWhere('description', 'ilike', "%{$term}%");
                });
            })
            ->when(isset($filters['official']), fn ($q) => $q->where('is_official', (bool) $filters['official']))
            ->when(($filters['owned'] ?? false) && $viewer, fn ($q) => $q->where('created_by', $viewer->id));

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
            $memberIds = DB::table('community_members')
                ->where('user_id', $viewer->id)
                ->whereIn('community_id', $ids)
                ->pluck('community_id')
                ->all();
            $set = array_flip($memberIds);
            $paginator->getCollection()->each(
                fn (Community $c) => $c->setAttribute('is_member', isset($set[$c->id])),
            );
        }

        return $paginator;
    }

    public function show(string $slug, ?User $viewer = null): Community
    {
        $community = Community::query()
            ->with(['category', 'avatar', 'cover', 'subcategories'])
            ->where('slug', $slug)
            ->first();

        if (! $community || $community->status !== CommunityStatus::Active) {
            throw new NotFoundHttpException('Сообщество не найдено.');
        }

        if ($viewer) {
            $community->setAttribute(
                'is_member',
                $community->members()->where('users.id', $viewer->id)->exists(),
            );
        }

        return $community;
    }

    public function apply(User $user, string $proposedName, ?string $description, int $categoryId): CommunityApplication
    {
        if (! CommunityCategory::query()->whereKey($categoryId)->where('is_active', true)->exists()) {
            throw ValidationException::withMessages([
                'category_id' => ['Категория не найдена.'],
            ]);
        }

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

            $community->members()->attach($application->user_id, [
                'role' => CommunityMemberRole::Owner->value,
                'joined_at' => now(),
            ]);

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

    public function join(User $user, Community $community): void
    {
        $this->assertActiveCommunity($community);

        if ($community->members()->where('users.id', $user->id)->exists()) {
            return;
        }

        $community->members()->attach($user->id, [
            'role' => CommunityMemberRole::Member->value,
            'joined_at' => now(),
        ]);

        $community->increment('members_count');
    }

    public function leave(User $user, Community $community): void
    {
        $this->assertActiveCommunity($community);

        $detached = $community->members()->detach($user->id);

        if ($detached > 0 && $community->members_count > 0) {
            $community->decrement('members_count');
        }
    }

    public function members(Community $community, int $perPage = 30): LengthAwarePaginator
    {
        $this->assertActiveCommunity($community);

        return $community->members()
            ->with('profile')
            ->orderByDesc('community_members.joined_at')
            ->paginate($perPage);
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
}

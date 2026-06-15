<?php

namespace Modules\User\Services;

use App\Enums\UserStatus;
use App\Models\NotificationPreference;
use App\Models\PostCategory;
use App\Models\User;
use App\Models\UserBlock;
use App\Models\UserProfile;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class UserService
{
    public function getPublicProfile(string $slug, ?User $viewer = null): UserProfile
    {
        $profile = UserProfile::query()
            ->with(['user', 'city', 'avatar'])
            ->where('slug', $slug)
            ->first();

        if (! $profile || ! $profile->user || $profile->user->status !== UserStatus::Active) {
            throw new NotFoundHttpException('Профиль не найден.');
        }

        if ($viewer && $viewer->id !== $profile->user_id) {
            $profile->setAttribute(
                'is_following',
                $profile->user->followers()->where('users.id', $viewer->id)->exists(),
            );
        }

        if ($viewer && $this->hasBlockBetween($viewer, $profile->user)) {
            throw new NotFoundHttpException('Профиль не найден.');
        }

        if (! $this->canViewProfile($profile, $viewer)) {
            throw new NotFoundHttpException('Профиль недоступен.');
        }

        return $profile;
    }

    public function updateProfile(User $user, array $data): UserProfile
    {
        $profile = $user->profile ?? throw ValidationException::withMessages([
            'profile' => ['Профиль не найден.'],
        ]);

        if (isset($data['slug']) && $data['slug'] !== $profile->slug) {
            $slug = Str::slug($data['slug']);
            if ($slug === '' || UserProfile::where('slug', $slug)->where('user_id', '!=', $user->id)->exists()) {
                throw ValidationException::withMessages([
                    'slug' => ['Этот адрес профиля уже занят.'],
                ]);
            }
            $data['slug'] = $slug;
        }

        $profile->fill($data)->save();

        return $profile->fresh(['city', 'avatar']);
    }

    /** @return Collection<int, NotificationPreference> */
    public function getSettings(User $user): Collection
    {
        return $user->notificationPreferences()->orderBy('channel')->orderBy('type')->get();
    }

    /**
     * @param  list<array{channel: string, type: string, enabled: bool}>  $preferences
     * @return Collection<int, NotificationPreference>
     */
    public function updateSettings(User $user, array $preferences): Collection
    {
        foreach ($preferences as $pref) {
            NotificationPreference::updateOrCreate(
                [
                    'user_id' => $user->id,
                    'channel' => $pref['channel'],
                    'type' => $pref['type'],
                ],
                ['enabled' => $pref['enabled']],
            );
        }

        return $this->getSettings($user);
    }

    public function updatePrivacy(User $user, array $settings): UserProfile
    {
        $profile = $user->profile ?? throw ValidationException::withMessages([
            'profile' => ['Профиль не найден.'],
        ]);

        $current = array_merge(UserProfile::DEFAULT_PRIVACY, $profile->privacy_settings ?? []);
        $profile->privacy_settings = array_merge($current, $settings);
        $profile->save();

        return $profile->fresh();
    }

    /** @return Collection<int, PostCategory> */
    public function getInterests(User $user): Collection
    {
        return $user->interests()->orderBy('name')->get();
    }

    /** @param  list<int>  $categoryIds */
    public function syncInterests(User $user, array $categoryIds): Collection
    {
        $categoryIds = array_values(array_unique($categoryIds));

        $validCount = PostCategory::query()
            ->whereIn('id', $categoryIds)
            ->where('is_active', true)
            ->count();

        if ($validCount !== count($categoryIds)) {
            throw ValidationException::withMessages([
                'category_ids' => ['Одна или несколько категорий не найдены.'],
            ]);
        }

        $user->interests()->sync($categoryIds);

        return $this->getInterests($user);
    }

    public function follow(User $follower, User $target): void
    {
        $this->assertNotSelf($follower, $target, 'follow');
        $this->assertNoBlock($follower, $target);

        if ($follower->following()->where('users.id', $target->id)->exists()) {
            return;
        }

        DB::transaction(function () use ($follower, $target): void {
            $follower->following()->attach($target->id);

            UserProfile::where('user_id', $follower->id)->increment('following_count');
            UserProfile::where('user_id', $target->id)->increment('followers_count');
        });
    }

    public function unfollow(User $follower, User $target): void
    {
        $this->assertNotSelf($follower, $target, 'unfollow');

        DB::transaction(function () use ($follower, $target): void {
            $detached = $follower->following()->detach($target->id);

            if ($detached > 0) {
                UserProfile::where('user_id', $follower->id)->where('following_count', '>', 0)->decrement('following_count');
                UserProfile::where('user_id', $target->id)->where('followers_count', '>', 0)->decrement('followers_count');
            }
        });
    }

    public function block(User $blocker, User $target, ?string $reason = null): void
    {
        $this->assertNotSelf($blocker, $target, 'block');

        DB::transaction(function () use ($blocker, $target, $reason): void {
            if ($blocker->following()->where('users.id', $target->id)->exists()) {
                $this->unfollow($blocker, $target);
            }
            if ($target->following()->where('users.id', $blocker->id)->exists()) {
                $this->unfollow($target, $blocker);
            }

            UserBlock::firstOrCreate(
                ['blocker_id' => $blocker->id, 'blocked_id' => $target->id],
                ['reason' => $reason],
            );
        });
    }

    /** @return Collection<int, User> */
    public function listBlocks(User $user): Collection
    {
        return $user->blockedUsers()
            ->with('profile')
            ->orderByDesc('user_blocks.created_at')
            ->get();
    }

    public function hasBlockBetween(User $a, User $b): bool
    {
        return UserBlock::query()
            ->where(function ($q) use ($a, $b): void {
                $q->where('blocker_id', $a->id)->where('blocked_id', $b->id);
            })
            ->orWhere(function ($q) use ($a, $b): void {
                $q->where('blocker_id', $b->id)->where('blocked_id', $a->id);
            })
            ->exists();
    }

    private function canViewProfile(UserProfile $profile, ?User $viewer): bool
    {
        $privacy = array_merge(UserProfile::DEFAULT_PRIVACY, $profile->privacy_settings ?? []);
        $visibility = $privacy['profile_visibility'] ?? 'public';

        if ($visibility === 'public') {
            return true;
        }

        if (! $viewer) {
            return false;
        }

        if ($viewer->id === $profile->user_id) {
            return true;
        }

        if ($visibility === 'registered') {
            return true;
        }

        if ($visibility === 'followers') {
            return $profile->user->followers()->where('users.id', $viewer->id)->exists();
        }

        return false;
    }

    private function assertNotSelf(User $actor, User $target, string $action): void
    {
        if ($actor->id === $target->id) {
            throw ValidationException::withMessages([
                'user' => ['Нельзя выполнить это действие для своего аккаунта.'],
            ]);
        }
    }

    private function assertNoBlock(User $follower, User $target): void
    {
        if ($this->hasBlockBetween($follower, $target)) {
            throw ValidationException::withMessages([
                'user' => ['Действие недоступно.'],
            ]);
        }
    }
}

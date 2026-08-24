<?php

namespace Modules\Channel\Services;

use App\Enums\ChannelApplicationStatus;
use App\Models\Channel;
use App\Models\ChannelApplication;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ChannelApplicationService
{
    public function apply(
        User $user,
        string $name,
        ?string $description,
        ?string $category,
        ?int $avatarMediaId = null,
        ?int $bannerMediaId = null,
        ?string $slug = null,
        ?string $kind = null,
        bool $commentsEnabled = true,
    ): ChannelApplication {
        $hasPending = ChannelApplication::query()
            ->where('user_id', $user->id)
            ->where('status', ChannelApplicationStatus::Pending)
            ->exists();

        if ($hasPending) {
            throw ValidationException::withMessages([
                'application' => ['У вас уже есть заявка на рассмотрении.'],
            ]);
        }

        return ChannelApplication::create([
            'user_id' => $user->id,
            'proposed_name' => $name,
            'proposed_slug' => $slug !== null && $slug !== '' ? self::normalizeSlug($slug) : null,
            'proposed_kind' => $kind,
            'comments_enabled' => $commentsEnabled,
            'description' => $description,
            'category' => $category,
            'avatar_media_id' => $avatarMediaId,
            'banner_media_id' => $bannerMediaId,
            'status' => ChannelApplicationStatus::Pending,
        ]);
    }

    /**
     * Approve a pending application: create the Channel owned by the
     * applicant and mark the application as reviewed.
     */
    public function approve(ChannelApplication $application, User $reviewer): Channel
    {
        $this->assertPending($application);

        return DB::transaction(function () use ($application, $reviewer): Channel {
            $kind = in_array($application->proposed_kind, ['brand', 'shop', 'author', 'expert'], true)
                ? $application->proposed_kind
                : 'author';
            $slugSource = $application->proposed_slug ?: $application->proposed_name;

            $channel = Channel::create([
                'owner_id' => $application->user_id,
                'name' => $application->proposed_name,
                'slug' => self::uniqueSlug($slugSource),
                'description' => $application->description,
                'category' => $application->category,
                'kind' => $kind,
                'comments_enabled' => (bool) $application->comments_enabled,
                'avatar_media_id' => $application->avatar_media_id,
                'banner_media_id' => $application->banner_media_id,
                'is_active' => true,
            ]);

            $application->update([
                'status' => ChannelApplicationStatus::Approved,
                'reviewed_by' => $reviewer->id,
                'reviewed_at' => now(),
            ]);

            return $channel;
        });
    }

    public function reject(ChannelApplication $application, User $reviewer, ?string $reason = null): ChannelApplication
    {
        $this->assertPending($application);

        $application->update([
            'status' => ChannelApplicationStatus::Rejected,
            'moderator_comment' => $reason,
            'reviewed_by' => $reviewer->id,
            'reviewed_at' => now(),
        ]);

        return $application->fresh();
    }

    public static function uniqueSlug(string $name): string
    {
        $slug = self::normalizeSlug($name) ?: 'channel';
        $original = $slug;
        $suffix = 1;

        while (Channel::withTrashed()->where('slug', $slug)->exists()) {
            $slug = $original.'-'.$suffix;
            $suffix++;
        }

        return $slug;
    }

    public static function normalizeSlug(string $value): string
    {
        $slug = Str::slug($value);

        return $slug !== '' ? Str::limit($slug, 80, '') : '';
    }

    private function assertPending(ChannelApplication $application): void
    {
        if ($application->status !== ChannelApplicationStatus::Pending) {
            throw ValidationException::withMessages([
                'application' => ['Заявка уже рассмотрена.'],
            ]);
        }
    }
}

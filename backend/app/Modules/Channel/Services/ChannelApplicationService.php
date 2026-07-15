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
    public function apply(User $user, string $name, ?string $description, ?string $category): ChannelApplication
    {
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
            'description' => $description,
            'category' => $category,
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
            $channel = Channel::create([
                'owner_id' => $application->user_id,
                'name' => $application->proposed_name,
                'slug' => self::uniqueSlug($application->proposed_name),
                'description' => $application->description,
                'category' => $application->category,
                'kind' => 'author',
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
        $slug = Str::slug($name) ?: 'channel';
        $original = $slug;
        $suffix = 1;

        while (Channel::withTrashed()->where('slug', $slug)->exists()) {
            $slug = $original.'-'.$suffix;
            $suffix++;
        }

        return $slug;
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

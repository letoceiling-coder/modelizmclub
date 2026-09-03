<?php

namespace App\Policies;

use App\Enums\ContentStatus;
use App\Models\Post;
use App\Models\User;

class PostPolicy
{
    public function view(?User $user, Post $post): bool
    {
        if ($post->status === ContentStatus::Published) {
            return true;
        }

        if (! $user) {
            return false;
        }

        if ($post->user_id === $user->id) {
            return true;
        }

        return $user->isModerator()
            && $post->status === ContentStatus::PendingModeration;
    }

    public function create(User $user): bool
    {
        return true;
    }

    public function update(User $user, Post $post): bool
    {
        if ($post->user_id !== $user->id) {
            return false;
        }

        return $post->isEditable() || $post->status === ContentStatus::Published;
    }

    public function delete(User $user, Post $post): bool
    {
        if ($post->user_id === $user->id) {
            return in_array($post->status, [
                ContentStatus::Draft,
                ContentStatus::Revision,
                ContentStatus::Scheduled,
                ContentStatus::Published,
                ContentStatus::PendingModeration,
                ContentStatus::Rejected,
                ContentStatus::Hidden,
                ContentStatus::Archived,
            ], true);
        }

        return $user->isModerator();
    }

    /** Reactions and comments — any signed-in account, published posts only. */
    public function react(User $user, Post $post): bool
    {
        return $post->status === ContentStatus::Published;
    }

    public function comment(User $user, Post $post): bool
    {
        return $post->status === ContentStatus::Published;
    }

    public function publish(User $user, Post $post): bool
    {
        return $post->user_id === $user->id
            && in_array($post->status, [
                ContentStatus::Draft,
                ContentStatus::Revision,
                ContentStatus::Scheduled,
            ], true);
    }
}

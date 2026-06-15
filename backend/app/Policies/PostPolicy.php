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
        return $post->user_id === $user->id && $post->isEditable();
    }

    public function delete(User $user, Post $post): bool
    {
        if ($post->user_id === $user->id) {
            return in_array($post->status, [
                ContentStatus::Draft,
                ContentStatus::Revision,
                ContentStatus::Published,
            ], true);
        }

        return $user->isModerator();
    }

    public function publish(User $user, Post $post): bool
    {
        return $post->user_id === $user->id
            && in_array($post->status, [
                ContentStatus::Draft,
                ContentStatus::Revision,
            ], true);
    }
}

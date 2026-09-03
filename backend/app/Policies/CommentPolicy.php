<?php

namespace App\Policies;

use App\Models\Comment;
use App\Models\User;

class CommentPolicy
{
    public function update(User $user, Comment $comment): bool
    {
        return (int) $comment->user_id === (int) $user->id || $user->isModerator();
    }

    public function delete(User $user, Comment $comment): bool
    {
        return (int) $comment->user_id === (int) $user->id || $user->isModerator();
    }

    /**
     * Any signed-in account may react to a published comment. The
     * guest / auth / subscription tier for reactions is a runtime setting
     * (feed guest access) enforced by the client gate, not a fixed rule here.
     */
    public function react(User $user, Comment $comment): bool
    {
        return $comment->status === 'published';
    }
}

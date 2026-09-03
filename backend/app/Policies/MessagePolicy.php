<?php

namespace App\Policies;

use App\Models\Message;
use App\Models\User;

class MessagePolicy
{
    /** Delete for everyone — the author only (moderators via admin tools). */
    public function delete(User $user, Message $message): bool
    {
        return (int) $message->user_id === (int) $user->id;
    }

    /** Hide for myself — any participant of the conversation. */
    public function hide(User $user, Message $message): bool
    {
        return $user->can('view', $message->conversation);
    }

    public function pin(User $user, Message $message): bool
    {
        return $user->can('pin', $message->conversation);
    }
}

<?php

namespace App\Policies;

use App\Models\Conversation;
use App\Models\User;

/** Every ability on a conversation reduces to "is a current participant". */
class ConversationPolicy
{
    public function view(User $user, Conversation $conversation): bool
    {
        return $this->isParticipant($user, $conversation);
    }

    public function send(User $user, Conversation $conversation): bool
    {
        return $this->isParticipant($user, $conversation);
    }

    public function delete(User $user, Conversation $conversation): bool
    {
        return $this->isParticipant($user, $conversation);
    }

    public function pin(User $user, Conversation $conversation): bool
    {
        return $this->isParticipant($user, $conversation);
    }

    private function isParticipant(User $user, Conversation $conversation): bool
    {
        if ($conversation->relationLoaded('participants')) {
            return $conversation->participants
                ->contains(fn ($p) => (int) $p->user_id === (int) $user->id && $p->left_at === null);
        }

        return $conversation->participants()
            ->where('user_id', $user->id)
            ->whereNull('left_at')
            ->exists();
    }
}

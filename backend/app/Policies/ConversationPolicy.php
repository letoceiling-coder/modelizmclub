<?php

namespace App\Policies;

use App\Enums\ConversationType;
use App\Models\Conversation;
use App\Models\User;

/**
 * Viewing needs participation; writing needs participation *and* the
 * subscriber rung — the access matrix puts direct messages, category
 * rooms and community chats behind the subscription. Moderators bypass the
 * subscription, not the participation.
 */
class ConversationPolicy
{
    public function view(User $user, Conversation $conversation): bool
    {
        return $this->isParticipant($user, $conversation);
    }

    /** Start a direct conversation with another user. */
    public function create(User $user): bool
    {
        return $this->isSubscriber($user);
    }

    public function send(User $user, Conversation $conversation): bool
    {
        if (! $this->isParticipant($user, $conversation)) {
            return false;
        }

        // A deal chat belongs to the two parties of the deal — buying or selling
        // is not a social feature, so no subscription is required there.
        if ($conversation->type === ConversationType::Deal) {
            return true;
        }

        return $this->isSubscriber($user);
    }

    public function delete(User $user, Conversation $conversation): bool
    {
        return $this->isParticipant($user, $conversation);
    }

    public function pin(User $user, Conversation $conversation): bool
    {
        return $this->isParticipant($user, $conversation);
    }

    private function isSubscriber(User $user): bool
    {
        return $user->isModerator() || $user->hasActiveSubscription();
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

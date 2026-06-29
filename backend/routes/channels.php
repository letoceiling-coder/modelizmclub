<?php

use App\Models\Conversation;
use App\Models\ConversationParticipant;
use Illuminate\Support\Facades\Broadcast;

// Personal signaling channel for WebRTC calls. A user may only subscribe to
// their own channel (keyed by their public UUID).
Broadcast::channel('calls.{uuid}', function ($user, string $uuid) {
    return $user->uuid === $uuid;
});

// Personal inbox: messages, notifications, and other per-user realtime events.
Broadcast::channel('user.{uuid}', function ($user, string $uuid) {
    return $user->uuid === $uuid;
});

// Global presence: every authenticated user joins so others can see who is online.
Broadcast::channel('online', function ($user) {
    $user->loadMissing('profile');

    return [
        'uuid' => $user->uuid,
        'name' => $user->profile?->display_name ?? $user->name,
    ];
});

Broadcast::channel('conversation.{uuid}', function ($user, string $uuid) {
    return ConversationParticipant::query()
        ->where('user_id', $user->id)
        ->whereNull('left_at')
        ->whereIn(
            'conversation_id',
            Conversation::query()->where('uuid', $uuid)->select('id'),
        )
        ->exists();
});

<?php

use App\Models\Conversation;
use App\Models\ConversationParticipant;
use Illuminate\Support\Facades\Broadcast;

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

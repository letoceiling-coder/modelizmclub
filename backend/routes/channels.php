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

/*
 * Общий канал присутствия: сюда входит каждый вошедший, и список участников
 * канал раздаёт всем подписчикам — так устроены presence-каналы.
 *
 * Поэтому здесь остаётся только `uuid`. Имя отсюда не читает никто: все пять
 * мест на клиенте спрашивают «онлайн ли вот этот» — `onlineSet.has(id)`, — а
 * человека, о котором спрашивают, берут из своего списка (друзья, участники
 * комнаты, собеседники). Имя в полезной нагрузке было лишним и раздавало
 * всей площадке список имён тех, кто сейчас на сайте (разведка 21.09).
 *
 * Сузить сам список до «только мои собеседники» одним общим каналом нельзя:
 * presence по устройству показывает всех своих участников. Это переделка на
 * канал под каждого наблюдаемого, и она ждёт отдельного решения.
 */
Broadcast::channel('online', function ($user) {
    return ['uuid' => $user->uuid];
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

<?php

namespace Modules\Chat\Services;

use App\Enums\ConversationType;
use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\Message;
use App\Models\User;
use App\Notifications\InAppNotification;
use App\Services\InAppNotify;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Modules\Chat\Events\MessageSent;
use Modules\Chat\Http\Resources\MessageResource;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class ChatService
{
    public function listConversations(User $user, int $perPage = 30): LengthAwarePaginator
    {
        $conversationIds = ConversationParticipant::query()
            ->where('user_id', $user->id)
            ->whereNull('left_at')
            ->pluck('conversation_id');

        return Conversation::query()
            ->whereIn('id', $conversationIds)
            ->with([
                'participants.user.profile.avatar',
                'latestMessage.author.profile.avatar',
                'latestMessage.attachments.media',
            ])
            ->orderByDesc('last_message_at')
            ->paginate($perPage);
    }

    public function findConversation(string $uuid, User $user): Conversation
    {
        $conversation = Conversation::query()
            ->where('uuid', $uuid)
            ->with(['participants.user.profile.avatar'])
            ->first();

        if (! $conversation || ! $this->isParticipant($conversation, $user)) {
            throw new NotFoundHttpException('Диалог не найден.');
        }

        return $conversation;
    }

    public function listMessages(string $conversationUuid, User $user, int $perPage = 50): LengthAwarePaginator
    {
        $conversation = $this->findConversation($conversationUuid, $user);

        return Message::query()
            ->where('conversation_id', $conversation->id)
            ->with(['author.profile.avatar', 'replyTo.author.profile', 'attachments.media'])
            ->orderByDesc('created_at')
            ->paginate($perPage);
    }

    /**
     * @param  list<string>  $mediaUuids
     */
    public function sendMessage(
        Conversation $conversation,
        User $user,
        ?string $body,
        ?string $replyToUuid = null,
        string $type = 'text',
        array $mediaUuids = [],
    ): Message {
        if (! $this->isParticipant($conversation, $user)) {
            throw ValidationException::withMessages(['conversation' => ['Нет доступа к диалогу.']]);
        }

        $replyToId = null;
        if ($replyToUuid) {
            $replyToId = Message::query()
                ->where('uuid', $replyToUuid)
                ->where('conversation_id', $conversation->id)
                ->value('id');
        }

        $mediaIds = [];
        if ($mediaUuids !== []) {
            $mediaIds = \App\Models\Media::query()
                ->whereIn('uuid', $mediaUuids)
                ->where('uploaded_by', $user->id)
                ->pluck('id')
                ->all();

            if ($mediaIds === []) {
                throw ValidationException::withMessages(['media_uuids' => ['Вложение не найдено.']]);
            }
        }

        return DB::transaction(function () use ($conversation, $user, $body, $replyToId, $type, $mediaIds): Message {
            $message = Message::create([
                'conversation_id' => $conversation->id,
                'user_id' => $user->id,
                'body' => $body,
                'type' => $type,
                'reply_to_id' => $replyToId,
                'status' => 'sent',
            ]);

            foreach ($mediaIds as $mediaId) {
                $message->attachments()->create(['media_id' => $mediaId]);
            }

            $conversation->update(['last_message_at' => now()]);

            $message->load(['author.profile.avatar', 'replyTo.author.profile', 'attachments.media', 'conversation']);

            try {
                broadcast(new MessageSent($message))->toOthers();
            } catch (\Throwable) {
                // Reverb may be unavailable during tests or maintenance
            }

            $this->notifyRecipients($conversation, $user, $message, $body, $type);

            return $message;
        });
    }

    public function findOrCreateDirect(User $from, User $to): Conversation
    {
        if ($from->id === $to->id) {
            throw ValidationException::withMessages(['user' => ['Нельзя написать самому себе.']]);
        }

        $existing = Conversation::query()
            ->where('type', ConversationType::Direct)
            ->whereHas('participants', fn ($q) => $q->where('user_id', $from->id)->whereNull('left_at'))
            ->whereHas('participants', fn ($q) => $q->where('user_id', $to->id)->whereNull('left_at'))
            ->first();

        if ($existing) {
            return $existing->load(['participants.user.profile']);
        }

        return DB::transaction(function () use ($from, $to): Conversation {
            $conversation = Conversation::create([
                'type' => ConversationType::Direct,
                'last_message_at' => now(),
            ]);

            foreach ([$from, $to] as $participant) {
                ConversationParticipant::create([
                    'conversation_id' => $conversation->id,
                    'user_id' => $participant->id,
                    'role' => 'member',
                    'joined_at' => now(),
                ]);
            }

            return $conversation->load(['participants.user.profile']);
        });
    }

    private function isParticipant(Conversation $conversation, User $user): bool
    {
        return ConversationParticipant::query()
            ->where('conversation_id', $conversation->id)
            ->where('user_id', $user->id)
            ->whereNull('left_at')
            ->exists();
    }

    private function notifyRecipients(
        Conversation $conversation,
        User $author,
        Message $message,
        ?string $body,
        string $type,
    ): void {
        $author->loadMissing('profile');
        $authorName = $author->profile?->display_name ?? $author->name ?? 'Пользователь';

        $preview = $body !== null && $body !== ''
            ? Str::limit($body, 80)
            : ($type === 'voice' ? 'Голосовое сообщение' : 'Новое сообщение');

        $messagePayload = (new MessageResource($message))->resolve();

        $recipients = ConversationParticipant::query()
            ->where('conversation_id', $conversation->id)
            ->where('user_id', '!=', $author->id)
            ->whereNull('left_at')
            ->with('user.profile')
            ->get();

        foreach ($recipients as $participant) {
            $recipient = $participant->user;
            if (! $recipient) {
                continue;
            }

            try {
                InAppNotify::send(
                    $recipient,
                    new InAppNotification(
                        'message',
                        $authorName,
                        $preview,
                        '/messenger?chat='.$conversation->uuid,
                    ),
                    'message',
                    [
                        'conversation_uuid' => $conversation->uuid,
                        'message' => $messagePayload,
                    ],
                );
            } catch (\Throwable) {
                // Reverb / notifications may be unavailable during maintenance
            }
        }
    }
}

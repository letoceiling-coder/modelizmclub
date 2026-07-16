<?php

namespace Modules\Chat\Services;

use App\Enums\ConversationType;
use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\Listing;
use App\Models\Media;
use App\Models\Message;
use App\Models\User;
use App\Notifications\InAppNotification;
use App\Services\InAppNotify;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Modules\Chat\Events\MessageSent;
use Modules\Chat\Http\Resources\MessageResource;
use Modules\Media\Services\MediaUploadService;
use Modules\User\Services\UserService;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class ChatService
{
    public function __construct(
        private UserService $users,
        private MediaUploadService $mediaUploads,
    ) {}

    public function listConversations(User $user, int $perPage = 30): LengthAwarePaginator
    {
        $conversationIds = ConversationParticipant::query()
            ->where('user_id', $user->id)
            ->whereNull('left_at')
            ->pluck('conversation_id');

        return Conversation::query()
            ->whereIn('conversations.id', $conversationIds)
            ->join('conversation_participants as cp', function ($join) use ($user): void {
                $join->on('cp.conversation_id', '=', 'conversations.id')
                    ->where('cp.user_id', $user->id)
                    ->whereNull('cp.left_at');
            })
            ->with([
                'participants.user.profile.avatar',
                'listing.mediaItems.media',
                'latestMessage.author.profile.avatar',
                'latestMessage.attachments.media',
                'pinnedMessage.author.profile.avatar',
            ])
            ->orderByRaw('cp.pinned_at IS NULL')
            ->orderByDesc('cp.pinned_at')
            ->orderByDesc('conversations.last_message_at')
            ->select('conversations.*')
            ->paginate($perPage);
    }

    public function showConversation(string $uuid, User $user): Conversation
    {
        $conversation = Conversation::query()
            ->where('uuid', $uuid)
            ->with([
                'participants.user.profile.avatar',
                'listing.mediaItems.media',
                'pinnedMessage.author.profile.avatar',
                'pinnedMessage.attachments.media',
                'latestMessage.author.profile.avatar',
                'latestMessage.attachments.media',
            ])
            ->first();

        if (! $conversation || ! $this->isParticipant($conversation, $user)) {
            throw new NotFoundHttpException('Диалог не найден.');
        }

        return $conversation;
    }

    public function findConversation(string $uuid, User $user): Conversation
    {
        return $this->showConversation($uuid, $user);
    }

    public function listMessages(string $conversationUuid, User $user, int $perPage = 50): LengthAwarePaginator
    {
        $conversation = $this->findConversation($conversationUuid, $user);

        return Message::query()
            ->where('conversation_id', $conversation->id)
            ->whereNotExists(function ($query) use ($user): void {
                $query->select(DB::raw(1))
                    ->from('message_user_hides')
                    ->whereColumn('message_user_hides.message_id', 'messages.id')
                    ->where('message_user_hides.user_id', $user->id);
            })
            ->with([
                'author.profile.avatar',
                'replyTo.author.profile',
                'forwardedFrom.author.profile.avatar',
                'attachments.media',
            ])
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
        ?string $forwardedFromMessageUuid = null,
    ): Message {
        if (! $this->isParticipant($conversation, $user)) {
            throw ValidationException::withMessages(['conversation' => ['Нет доступа к диалогу.']]);
        }

        $otherParticipant = $this->otherParticipant($conversation, $user);
        if ($otherParticipant) {
            $this->users->assertCanInteract($user, $otherParticipant);
        }

        $replyToId = null;
        if ($replyToUuid) {
            $replyToId = Message::query()
                ->where('uuid', $replyToUuid)
                ->where('conversation_id', $conversation->id)
                ->value('id');
        }

        $forwardedFromId = null;
        if ($forwardedFromMessageUuid) {
            $source = Message::query()
                ->where('uuid', $forwardedFromMessageUuid)
                ->first();

            if (! $source) {
                throw ValidationException::withMessages([
                    'forwarded_from_message_uuid' => ['Исходное сообщение не найдено.'],
                ]);
            }

            $sourceConversation = Conversation::query()->find($source->conversation_id);
            if (! $sourceConversation || ! $this->isParticipant($sourceConversation, $user)) {
                throw ValidationException::withMessages([
                    'forwarded_from_message_uuid' => ['Нет доступа к исходному сообщению.'],
                ]);
            }

            $forwardedFromId = $source->id;
        }

        $mediaIds = [];
        if ($mediaUuids !== []) {
            $mediaIds = Media::query()
                ->whereIn('uuid', $mediaUuids)
                ->where('uploaded_by', $user->id)
                ->pluck('id')
                ->all();

            if ($mediaIds === []) {
                throw ValidationException::withMessages(['media_uuids' => ['Вложение не найдено.']]);
            }
        }

        return DB::transaction(function () use ($conversation, $user, $body, $replyToId, $forwardedFromId, $type, $mediaIds): Message {
            $message = Message::create([
                'conversation_id' => $conversation->id,
                'user_id' => $user->id,
                'body' => $body,
                'type' => $type,
                'reply_to_id' => $replyToId,
                'forwarded_from_message_id' => $forwardedFromId,
                'status' => 'sent',
            ]);

            foreach ($mediaIds as $mediaId) {
                $message->attachments()->create(['media_id' => $mediaId]);
            }

            $conversation->update(['last_message_at' => now()]);

            $message->load([
                'author.profile.avatar',
                'replyTo.author.profile',
                'forwardedFrom.author.profile.avatar',
                'attachments.media',
                'conversation',
            ]);

            try {
                broadcast(new MessageSent($message))->toOthers();
            } catch (\Throwable) {
                // Reverb may be unavailable during tests or maintenance
            }

            $this->notifyRecipients($conversation, $user, $message, $body, $type);

            return $message;
        });
    }

    public function findOrCreateDirect(User $from, User $to, ?Listing $listing = null): Conversation
    {
        if ($from->id === $to->id) {
            throw ValidationException::withMessages(['user' => ['Нельзя написать самому себе.']]);
        }

        $this->users->assertCanInteract($from, $to);

        $existing = Conversation::query()
            ->where('type', ConversationType::Direct)
            ->whereHas('participants', fn ($q) => $q->where('user_id', $from->id)->whereNull('left_at'))
            ->whereHas('participants', fn ($q) => $q->where('user_id', $to->id)->whereNull('left_at'))
            ->first();

        if ($existing) {
            if ($listing && $existing->listing_id !== $listing->id) {
                $existing->update(['listing_id' => $listing->id]);
            }

            return $existing->load(['participants.user.profile', 'listing.mediaItems.media']);
        }

        return DB::transaction(function () use ($from, $to, $listing): Conversation {
            $conversation = Conversation::create([
                'type' => ConversationType::Direct,
                'listing_id' => $listing?->id,
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

            return $conversation->load(['participants.user.profile', 'listing.mediaItems.media']);
        });
    }

    /** @return array{url: ?string, type: string, name: string, size: int, media_uuid: string} */
    public function uploadAttachment(Conversation $conversation, User $user, UploadedFile $file): array
    {
        if (! $this->isParticipant($conversation, $user)) {
            throw ValidationException::withMessages(['conversation' => ['Нет доступа к диалогу.']]);
        }

        $media = $this->mediaUploads->storeUploadedFile($user, $file, 'chat');
        $type = str_starts_with((string) $media->mime_type, 'image/') ? 'image' : 'file';

        return [
            'url' => $media->url,
            'type' => $type,
            'name' => $media->filename,
            'size' => $media->size_bytes,
            'media_uuid' => $media->uuid,
        ];
    }

    public function hideMessageForUser(Conversation $conversation, Message $message, User $user): void
    {
        if (! $this->isParticipant($conversation, $user)) {
            throw ValidationException::withMessages(['conversation' => ['Нет доступа к диалогу.']]);
        }

        if ($message->conversation_id !== $conversation->id) {
            throw new NotFoundHttpException('Сообщение не найдено.');
        }

        DB::table('message_user_hides')->updateOrInsert(
            [
                'user_id' => $user->id,
                'message_id' => $message->id,
            ],
            [
                'hidden_at' => now(),
            ],
        );
    }

    public function pinMessage(Conversation $conversation, Message $message, User $user): void
    {
        if (! $this->isParticipant($conversation, $user)) {
            throw ValidationException::withMessages(['conversation' => ['Нет доступа к диалогу.']]);
        }

        if ($message->conversation_id !== $conversation->id) {
            throw new NotFoundHttpException('Сообщение не найдено.');
        }

        $conversation->update(['pinned_message_id' => $message->id]);
    }

    public function unpinMessage(Conversation $conversation, User $user): void
    {
        if (! $this->isParticipant($conversation, $user)) {
            throw ValidationException::withMessages(['conversation' => ['Нет доступа к диалогу.']]);
        }

        $conversation->update(['pinned_message_id' => null]);
    }

    public function pinConversation(Conversation $conversation, User $user): void
    {
        ConversationParticipant::query()
            ->where('conversation_id', $conversation->id)
            ->where('user_id', $user->id)
            ->whereNull('left_at')
            ->update(['pinned_at' => now()]);
    }

    public function unpinConversation(Conversation $conversation, User $user): void
    {
        ConversationParticipant::query()
            ->where('conversation_id', $conversation->id)
            ->where('user_id', $user->id)
            ->whereNull('left_at')
            ->update(['pinned_at' => null]);
    }

    public function findMessageInConversation(Conversation $conversation, string $messageUuid): Message
    {
        $message = Message::query()
            ->where('uuid', $messageUuid)
            ->where('conversation_id', $conversation->id)
            ->first();

        if (! $message) {
            throw new NotFoundHttpException('Сообщение не найдено.');
        }

        return $message;
    }

    private function isParticipant(Conversation $conversation, User $user): bool
    {
        return ConversationParticipant::query()
            ->where('conversation_id', $conversation->id)
            ->where('user_id', $user->id)
            ->whereNull('left_at')
            ->exists();
    }

    private function otherParticipant(Conversation $conversation, User $user): ?User
    {
        $participant = ConversationParticipant::query()
            ->where('conversation_id', $conversation->id)
            ->where('user_id', '!=', $user->id)
            ->whereNull('left_at')
            ->with('user')
            ->first();

        return $participant?->user;
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

    public function leaveConversation(User $user, string $uuid): void
    {
        $conversation = $this->findConversation($uuid, $user);

        ConversationParticipant::query()
            ->where('conversation_id', $conversation->id)
            ->where('user_id', $user->id)
            ->whereNull('left_at')
            ->update(['left_at' => now()]);
    }
}

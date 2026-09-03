<?php

namespace Modules\Chat\Services;

use App\Enums\ConversationType;
use App\Events\UserRealtimeEvent;
use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\Listing;
use App\Models\Media;
use App\Models\Message;
use App\Models\PostCategory;
use App\Models\User;
use App\Notifications\InAppNotification;
use App\Services\InAppNotify;
use App\Support\UserLabel;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Modules\Chat\Events\MessageDeleted;
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

    public function listConversations(User $user, int $perPage = 30, string $space = 'chats'): LengthAwarePaginator
    {
        $conversationIds = ConversationParticipant::query()
            ->where('user_id', $user->id)
            ->whereNull('left_at')
            ->pluck('conversation_id');

        $paginator = Conversation::query()
            ->whereIn('conversations.id', $conversationIds)
            ->when($space === 'communities', function ($q): void {
                $q->where('conversations.type', ConversationType::Community);
            })
            ->when($space === 'rooms', function ($q): void {
                $q->where('conversations.type', ConversationType::Room);
            })
            ->when($space === 'chats', function ($q): void {
                $q->where('conversations.type', '!=', ConversationType::Room)
                    ->where('conversations.type', '!=', ConversationType::Community);
            })
            ->join('conversation_participants as cp', function ($join) use ($user): void {
                $join->on('cp.conversation_id', '=', 'conversations.id')
                    ->where('cp.user_id', $user->id)
                    ->whereNull('cp.left_at');
            })
            ->select('conversations.*')
            ->selectRaw('(
                SELECT COUNT(*)
                FROM messages
                WHERE messages.conversation_id = conversations.id
                AND messages.user_id != ?
                AND messages.deleted_at IS NULL
                AND NOT EXISTS (
                    SELECT 1 FROM message_user_hides
                    WHERE message_user_hides.message_id = messages.id
                    AND message_user_hides.user_id = ?
                )
                AND (
                    cp.last_read_message_id IS NULL
                    OR messages.id > cp.last_read_message_id
                )
            ) as unread_count', [$user->id, $user->id])
            ->with([
                'participants.user.profile.avatar',
                'listing.mediaItems.media',
                'latestMessage.author.profile.avatar',
                'latestMessage.attachments.media',
                'latestMessage.post.mediaItems.media',
                'pinnedMessage.author.profile.avatar',
                'community.avatar',
                'safeDeal',
            ])
            ->orderByRaw('cp.pinned_at IS NULL')
            ->orderByDesc('cp.pinned_at')
            ->orderByDesc('conversations.last_message_at')
            ->paginate($perPage);

        return $paginator;
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
                'latestMessage.post.mediaItems.media',
                'community.avatar',
                'safeDeal',
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

    /**
     * Resolve (or create) the shared chat room for a post-category subcategory.
     * Any authenticated user is auto-joined as a participant on first visit.
     */
    public function findOrCreateCategoryRoom(int $parentCategoryId, int $subCategoryId, User $user): Conversation
    {
        $sub = PostCategory::query()
            ->whereKey($subCategoryId)
            ->where('is_active', true)
            ->first();

        // Rooms exist on levels 2 and 3, so the URL parent is any ancestor.
        if (! $sub || ! $this->isDescendantOf($sub, $parentCategoryId)) {
            throw new NotFoundHttpException('Подкатегория не найдена.');
        }

        $conversation = Conversation::query()
            ->where('type', ConversationType::Room)
            ->where('post_category_id', $sub->id)
            ->first();

        if (! $conversation) {
            $conversation = DB::transaction(function () use ($sub): Conversation {
                return Conversation::create([
                    'type' => ConversationType::Room,
                    'post_category_id' => $sub->id,
                    'title' => $sub->name,
                ]);
            });
        }

        $this->ensureParticipant($conversation, $user);

        return $conversation;
    }

    private function isDescendantOf(PostCategory $category, int $ancestorId): bool
    {
        $current = $category;
        for ($depth = 0; $depth < 5; $depth++) {
            if ($current->parent_id === null) {
                return false;
            }
            if ($current->parent_id === $ancestorId) {
                return true;
            }
            $current = PostCategory::query()->whereKey($current->parent_id)->first();
            if (! $current) {
                return false;
            }
        }

        return false;
    }

    /** @return \Illuminate\Support\Collection<int, int> */
    private function descendantCategoryIds(int $parentCategoryId): \Illuminate\Support\Collection
    {
        $ids = collect();
        $frontier = collect([$parentCategoryId]);

        for ($depth = 0; $depth < 5 && $frontier->isNotEmpty(); $depth++) {
            $frontier = PostCategory::query()
                ->whereIn('parent_id', $frontier)
                ->where('is_active', true)
                ->pluck('id');
            $ids = $ids->merge($frontier);
        }

        return $ids->unique()->values();
    }

    public const PRESENCE_ONLINE_SECONDS = 120;

    public function isRecentlyActive(User $user): bool
    {
        return $user->last_seen_at !== null
            && $user->last_seen_at->greaterThan(now()->subSeconds(self::PRESENCE_ONLINE_SECONDS));
    }

    /**
     * @return array{members: Collection<int, ConversationParticipant>, online_count: int, total: int}
     */
    public function listCategoryRoomMembers(int $parentCategoryId, int $subCategoryId, User $user): array
    {
        $conversation = $this->findOrCreateCategoryRoom($parentCategoryId, $subCategoryId, $user);

        $members = ConversationParticipant::query()
            ->where('conversation_id', $conversation->id)
            ->whereNull('left_at')
            ->with(['user.profile.avatar', 'user.profile.city'])
            ->get()
            ->sortByDesc(fn (ConversationParticipant $p) => $this->isRecentlyActive($p->user) ? 1 : 0)
            ->values();

        $onlineCount = $members->filter(fn (ConversationParticipant $p) => $this->isRecentlyActive($p->user))->count();

        return [
            'members' => $members,
            'online_count' => $onlineCount,
            'total' => $members->count(),
        ];
    }

    /**
     * @return array{
     *     by_subcategory: array<string, array{members: int, online: int}>,
     *     by_parent: array<string, array{members: int, online: int}>
     * }
     */
    public function postCategoryRoomStats(?int $parentCategoryId = null): array
    {
        $query = Conversation::query()
            ->where('type', ConversationType::Room)
            ->whereNotNull('post_category_id');

        if ($parentCategoryId !== null) {
            $query->whereIn('post_category_id', $this->descendantCategoryIds($parentCategoryId));
        }

        $conversations = $query
            ->with(['participants' => fn ($q) => $q->whereNull('left_at')->with('user')])
            ->get();

        $bySubcategory = [];
        $byParent = [];

        $parentIdsBySub = PostCategory::query()
            ->whereIn('id', $conversations->pluck('post_category_id')->filter()->unique())
            ->pluck('parent_id', 'id');

        foreach ($conversations as $conversation) {
            $subId = (string) $conversation->post_category_id;
            $members = $conversation->participants->count();
            $online = $conversation->participants
                ->filter(fn (ConversationParticipant $p) => $this->isRecentlyActive($p->user))
                ->count();

            $bySubcategory[$subId] = ['members' => $members, 'online' => $online];

            $parentId = $parentIdsBySub->get($conversation->post_category_id);
            if ($parentId) {
                $parentKey = (string) $parentId;
                $byParent[$parentKey]['members'] = ($byParent[$parentKey]['members'] ?? 0) + $members;
                $byParent[$parentKey]['online'] = ($byParent[$parentKey]['online'] ?? 0) + $online;
            }
        }

        return [
            'by_subcategory' => $bySubcategory,
            'by_parent' => $byParent,
        ];
    }

    private function ensureParticipant(Conversation $conversation, User $user): void
    {
        $existing = ConversationParticipant::query()
            ->where('conversation_id', $conversation->id)
            ->where('user_id', $user->id)
            ->first();

        if ($existing) {
            if ($existing->left_at !== null) {
                $existing->update(['left_at' => null, 'joined_at' => now()]);
            }

            return;
        }

        ConversationParticipant::create([
            'conversation_id' => $conversation->id,
            'user_id' => $user->id,
            'role' => 'member',
            'joined_at' => now(),
        ]);
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
                'listing.mediaItems.media',
                'post.author.profile',
                'post.mediaItems.media',
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
        ?\App\Models\Post $post = null,
    ): Message {
        if (! $this->isParticipant($conversation, $user)) {
            throw ValidationException::withMessages(['conversation' => ['Нет доступа к диалогу.']]);
        }

        if ($conversation->type !== ConversationType::Room) {
            $otherParticipant = $this->otherParticipant($conversation, $user);
            if ($otherParticipant) {
                $this->users->assertCanInteract($user, $otherParticipant);
            }
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

        $message = DB::transaction(function () use ($conversation, $user, $body, $replyToId, $forwardedFromId, $type, $mediaIds, $post): Message {
            $message = Message::create([
                'conversation_id' => $conversation->id,
                'user_id' => $user->id,
                'body' => $body,
                'type' => $post ? 'post' : $type,
                'post_id' => $post?->id,
                'reply_to_id' => $replyToId,
                'forwarded_from_message_id' => $forwardedFromId,
                'status' => 'sent',
            ]);

            foreach ($mediaIds as $mediaId) {
                $message->attachments()->create(['media_id' => $mediaId]);
            }

            $conversation->update(['last_message_at' => now()]);

            return $message->load([
                'author.profile.avatar',
                'replyTo.author.profile',
                'forwardedFrom.author.profile.avatar',
                'attachments.media',
                'post.author.profile',
                'post.mediaItems.media',
                'listing.mediaItems.media',
                'conversation',
            ]);
        });

        // Broadcast / notify after commit so a Reverb or notification failure
        // cannot roll back a message the user already sent.
        $this->dispatchMessageSideEffects($message, $conversation, $user, $body, $post ? 'post' : $type);

        return $message;
    }

    public function findOrCreateDirect(User $from, User $to, ?Listing $listing = null): Conversation
    {
        if ($from->id === $to->id) {
            throw ValidationException::withMessages(['user' => ['Нельзя написать самому себе.']]);
        }

        $this->users->assertCanInteract($from, $to);

        $existing = $this->findDirectBetweenUsers($from, $to);

        if ($existing) {
            $all = $this->allDirectBetweenUsers($from, $to);
            $this->rejoinDirectConversation($existing, $from, $to);
            $this->hideDuplicateDirectConversations($all, $existing, $from, $to);

            return $this->finalizeDirectConversation($existing, $listing, $from);
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

            return $this->finalizeDirectConversation(
                $conversation->load(['participants.user.profile', 'listing.mediaItems.media']),
                $listing,
                $from,
            );
        });
    }

    /** @return array{url: ?string, type: string, name: string, size: int, media_uuid: string, variants: ?array} */
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
            'variants' => $media->publicVariantUrls() ?: null,
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

    public function deleteMessageForEveryone(Conversation $conversation, Message $message, User $user): void
    {
        if (! $this->isParticipant($conversation, $user)) {
            throw ValidationException::withMessages(['conversation' => ['Нет доступа к диалогу.']]);
        }

        if ($message->conversation_id !== $conversation->id) {
            throw new NotFoundHttpException('Сообщение не найдено.');
        }

        if ((int) $message->user_id !== (int) $user->id) {
            throw ValidationException::withMessages([
                'message' => ['Можно удалить только своё сообщение.'],
            ]);
        }

        $conversationUuid = $conversation->uuid;

        DB::transaction(function () use ($conversation, $message): void {
            if ((int) $conversation->pinned_message_id === (int) $message->id) {
                $conversation->update(['pinned_message_id' => null]);
            }

            $message->delete();
        });

        try {
            broadcast(new MessageDeleted($message, $conversationUuid));
        } catch (\Throwable) {
            // Reverb may be unavailable during tests or maintenance
        }
    }

    public function clearHistoryForUser(Conversation $conversation, User $user): void
    {
        if (! $this->isParticipant($conversation, $user)) {
            throw ValidationException::withMessages(['conversation' => ['Нет доступа к диалогу.']]);
        }

        DB::transaction(function () use ($conversation, $user): void {
            $now = now();

            DB::insert(
                'INSERT INTO message_user_hides (user_id, message_id, hidden_at)
                 SELECT ?, m.id, ?
                 FROM messages m
                 WHERE m.conversation_id = ?
                 AND NOT EXISTS (
                     SELECT 1 FROM message_user_hides h
                     WHERE h.message_id = m.id AND h.user_id = ?
                 )',
                [$user->id, $now, $conversation->id, $user->id],
            );

            $latestId = Message::query()
                ->where('conversation_id', $conversation->id)
                ->orderByDesc('id')
                ->value('id');

            if ($latestId) {
                ConversationParticipant::query()
                    ->where('conversation_id', $conversation->id)
                    ->where('user_id', $user->id)
                    ->whereNull('left_at')
                    ->update(['last_read_message_id' => $latestId]);
            }
        });
    }

    public function isMessageHiddenForUser(Message $message, User $user): bool
    {
        return DB::table('message_user_hides')
            ->where('user_id', $user->id)
            ->where('message_id', $message->id)
            ->exists();
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

    public function markConversationRead(Conversation $conversation, User $user): void
    {
        if (! $this->isParticipant($conversation, $user)) {
            throw ValidationException::withMessages(['conversation' => ['Нет доступа к диалогу.']]);
        }

        $latestId = Message::query()
            ->where('conversation_id', $conversation->id)
            ->orderByDesc('id')
            ->value('id');

        if (! $latestId) {
            return;
        }

        ConversationParticipant::query()
            ->where('conversation_id', $conversation->id)
            ->where('user_id', $user->id)
            ->whereNull('left_at')
            ->update(['last_read_message_id' => $latestId]);

        try {
            $this->markConversationNotificationsRead($user, $conversation);
        } catch (\Throwable $e) {
            Log::warning('chat_mark_read_notifications_failed', [
                'conversation_uuid' => $conversation->uuid,
                'user_id' => $user->id,
                'exception' => $e->getMessage(),
            ]);
        }

        $this->notifyConversationRead($conversation, $user);
    }

    public function otherParticipantLastReadMessageId(Conversation $conversation, User $user): ?int
    {
        $value = ConversationParticipant::query()
            ->where('conversation_id', $conversation->id)
            ->where('user_id', '!=', $user->id)
            ->whereNull('left_at')
            ->value('last_read_message_id');

        return $value !== null ? (int) $value : null;
    }

    /** Preload peer read cursor + last_seen for MessageResource status resolution. */
    public function attachMessageStatusContext(\Illuminate\Http\Request $request, Conversation $conversation, User $user): void
    {
        $other = ConversationParticipant::query()
            ->where('conversation_id', $conversation->id)
            ->where('user_id', '!=', $user->id)
            ->whereNull('left_at')
            ->with('user:id,last_seen_at')
            ->first();

        $request->attributes->set(
            'chat_other_last_read_message_id',
            $other?->last_read_message_id,
        );
        $request->attributes->set(
            'chat_other_last_seen_at',
            $other?->user?->last_seen_at,
        );
    }

    public function unreadCountFor(Conversation $conversation, User $user, ?int $lastReadMessageId = null): int
    {
        if ($lastReadMessageId === null) {
            $lastReadMessageId = ConversationParticipant::query()
                ->where('conversation_id', $conversation->id)
                ->where('user_id', $user->id)
                ->whereNull('left_at')
                ->value('last_read_message_id');
        }

        $query = Message::query()
            ->where('conversation_id', $conversation->id)
            ->where('user_id', '!=', $user->id)
            ->whereNotExists(function ($q) use ($user): void {
                $q->select(DB::raw(1))
                    ->from('message_user_hides')
                    ->whereColumn('message_user_hides.message_id', 'messages.id')
                    ->where('message_user_hides.user_id', $user->id);
            });

        if ($lastReadMessageId) {
            $query->where('id', '>', $lastReadMessageId);
        }

        return (int) $query->count();
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

    private function dispatchMessageSideEffects(
        Message $message,
        Conversation $conversation,
        User $user,
        ?string $body,
        string $type,
    ): void {
        try {
            broadcast(new MessageSent($message))->toOthers();
        } catch (\Throwable) {
            // Reverb may be unavailable during tests or maintenance
        }

        try {
            $this->notifyRecipients($conversation, $user, $message, $body, $type);
        } catch (\Throwable $e) {
            Log::warning('Chat notifyRecipients failed after message persist', [
                'message_uuid' => $message->uuid,
                'exception' => $e->getMessage(),
            ]);
        }
    }

    private function notifyRecipients(
        Conversation $conversation,
        User $author,
        Message $message,
        ?string $body,
        string $type,
    ): void {
        // Room chats are scoped to category pages; conversation-channel events cover live updates.
        if ($conversation->type === ConversationType::Room) {
            return;
        }

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
                broadcast(new UserRealtimeEvent(
                    $recipient->uuid,
                    'message',
                    [
                        'conversation_uuid' => $conversation->uuid,
                        'message' => $messagePayload,
                    ],
                ));
            } catch (\Throwable) {
                // Reverb may be unavailable during tests or maintenance
            }

            $this->upsertAggregatedMessageNotification($recipient, $author, $conversation, $body, $type);
        }
    }

    private function conversationNotificationLink(Conversation $conversation): string
    {
        return '/messenger?chat='.$conversation->uuid;
    }

    private function upsertAggregatedMessageNotification(
        User $recipient,
        User $author,
        Conversation $conversation,
        ?string $body,
        string $type,
    ): void {
        $link = $this->conversationNotificationLink($conversation);
        $preview = mb_substr(trim((string) $body), 0, 140);
        if ($preview === '') {
            $preview = $type === 'post' ? 'Поделился публикацией' : 'Новое сообщение';
        }
        $title = UserLabel::display($author).' написал(а) вам';

        $existing = $recipient->unreadNotifications()
            ->whereRaw("(data::jsonb->>'link') = ?", [$link])
            ->whereRaw("(data::jsonb->>'type') in (?, ?)", ['messages', 'message'])
            ->first();

        if ($existing) {
            $data = is_array($existing->data) ? $existing->data : [];
            $data['type'] = 'messages';
            $data['title'] = $title;
            $data['body'] = $preview;
            $data['link'] = $link;
            $existing->forceFill(['data' => $data])->save();

            return;
        }

        InAppNotify::sendQuiet(
            $recipient,
            new InAppNotification('messages', $title, $preview, $link),
        );
    }

    private function markConversationNotificationsRead(User $user, Conversation $conversation): void
    {
        $link = $this->conversationNotificationLink($conversation);

        $user->unreadNotifications()
            ->whereRaw("(data::jsonb->>'link') = ?", [$link])
            ->get()
            ->each(function ($notification): void {
                $notification->markAsRead();
            });
    }

    private function notifyConversationRead(Conversation $conversation, User $reader): void
    {
        $others = ConversationParticipant::query()
            ->where('conversation_id', $conversation->id)
            ->where('user_id', '!=', $reader->id)
            ->whereNull('left_at')
            ->with('user')
            ->get();

        foreach ($others as $participant) {
            $user = $participant->user;
            if (! $user) {
                continue;
            }

            try {
                broadcast(new UserRealtimeEvent(
                    $user->uuid,
                    'conversation.read',
                    [
                        'conversation_uuid' => $conversation->uuid,
                    ],
                ));
            } catch (\Throwable) {
                // Reverb may be unavailable during tests or maintenance
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

    /** @return Collection<int, Conversation> */
    private function allDirectBetweenUsers(User $a, User $b): Collection
    {
        return Conversation::query()
            ->where('type', ConversationType::Direct)
            ->whereHas('participants', fn ($q) => $q->where('user_id', $a->id))
            ->whereHas('participants', fn ($q) => $q->where('user_id', $b->id))
            ->withCount('messages')
            ->orderByDesc('messages_count')
            ->orderByDesc('last_message_at')
            ->orderBy('id')
            ->get();
    }

    private function findDirectBetweenUsers(User $a, User $b): ?Conversation
    {
        return $this->allDirectBetweenUsers($a, $b)->first();
    }

    private function rejoinDirectConversation(Conversation $conversation, User $a, User $b): void
    {
        ConversationParticipant::query()
            ->where('conversation_id', $conversation->id)
            ->whereIn('user_id', [$a->id, $b->id])
            ->update(['left_at' => null]);
    }

    /** @param  Collection<int, Conversation>  $all */
    private function hideDuplicateDirectConversations(
        Collection $all,
        Conversation $primary,
        User $a,
        User $b,
    ): void {
        $duplicateIds = $all
            ->where('id', '!=', $primary->id)
            ->pluck('id');

        if ($duplicateIds->isEmpty()) {
            return;
        }

        ConversationParticipant::query()
            ->whereIn('conversation_id', $duplicateIds)
            ->whereIn('user_id', [$a->id, $b->id])
            ->update(['left_at' => now()]);
    }

    private function finalizeDirectConversation(Conversation $conversation, ?Listing $listing, ?User $initiator = null): Conversation
    {
        if ($listing && $conversation->listing_id !== $listing->id) {
            $conversation->update(['listing_id' => $listing->id]);
        }

        if ($listing && $initiator) {
            $this->ensureListingIntroMessage($conversation, $listing, $initiator);
        }

        return $conversation->load(['participants.user.profile', 'listing.mediaItems.media']);
    }

    private function ensureListingIntroMessage(Conversation $conversation, Listing $listing, User $buyer): void
    {
        $exists = Message::query()
            ->where('conversation_id', $conversation->id)
            ->where('listing_id', $listing->id)
            ->where('type', 'listing')
            ->exists();

        if ($exists) {
            return;
        }

        $message = Message::create([
            'conversation_id' => $conversation->id,
            'user_id' => $buyer->id,
            'body' => null,
            'type' => 'listing',
            'listing_id' => $listing->id,
            'status' => 'sent',
        ]);

        $conversation->update(['last_message_at' => now()]);

        $message->load([
            'author.profile.avatar',
            'listing.mediaItems.media',
            'conversation',
        ]);

        DB::afterCommit(function () use ($message): void {
            try {
                broadcast(new MessageSent($message))->toOthers();
            } catch (\Throwable) {
                // Reverb may be unavailable during tests or maintenance
            }
        });
    }

    /** @param  Collection<int, Conversation>  $conversations */
    private function dedupeDirectConversationsForUser(Collection $conversations, User $user): Collection
    {
        $seenPartners = [];

        return $conversations
            ->filter(function (Conversation $conv) use ($user, &$seenPartners): bool {
                if ($conv->type !== ConversationType::Direct) {
                    return true;
                }

                $otherId = $conv->participants
                    ->first(fn (ConversationParticipant $p) => $p->user_id !== $user->id)
                    ?->user_id;

                if ($otherId === null) {
                    return true;
                }

                if (isset($seenPartners[$otherId])) {
                    return false;
                }

                $seenPartners[$otherId] = true;

                return true;
            })
            ->values();
    }

    /**
     * Append an authorless notice ("Сделка №… — Отправлена") to a conversation.
     *
     * System messages have no sender, so they are not attributed to either
     * side and never count towards anyone's unread badge; the client renders
     * type `system` as a centred notice.
     */
    public function postSystemMessage(Conversation $conversation, string $body): Message
    {
        $message = Message::create([
            'conversation_id' => $conversation->id,
            'user_id' => null,
            'body' => $body,
            'type' => 'system',
            'status' => 'sent',
        ]);

        $conversation->forceFill(['last_message_at' => now()])->save();

        $message->setRelation('conversation', $conversation);

        DB::afterCommit(function () use ($message): void {
            try {
                broadcast(new MessageSent($message));
            } catch (\Throwable) {
                // Reverb may be unavailable during tests or maintenance
            }
        });

        return $message;
    }
}

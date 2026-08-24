<?php

namespace Modules\Community\Services;

use App\Enums\CommunityMemberRole;
use App\Enums\ConversationType;
use App\Models\Community;
use App\Models\CommunityEvent;
use App\Models\CommunityJoinRequest;
use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\Media;
use App\Models\Post;
use App\Models\PostCategory;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class CommunityHubService
{
    /** @param array<string, mixed> $payload */
    public function applyPayloadFromRequest(array $input): array
    {
        $contacts = is_array($input['contacts'] ?? null) ? $input['contacts'] : [];

        return [
            'city_id' => isset($input['city_id']) ? (int) $input['city_id'] : null,
            'post_category_ids' => array_values(array_unique(array_map('intval', $input['post_category_ids'] ?? []))),
            'custom_category' => $this->nullableString($input['custom_category'] ?? null, 120),
            'rules' => $this->nullableString($input['rules'] ?? null, 8000),
            'access_type' => ($input['access_type'] ?? 'open') === 'request' ? 'request' : 'open',
            'contacts' => [
                'telegram' => $this->nullableString($contacts['telegram'] ?? null, 255),
                'website' => $this->nullableString($contacts['website'] ?? null, 255),
                'phone' => $this->nullableString($contacts['phone'] ?? null, 40),
            ],
            'avatar_media_uuid' => $this->nullableString($input['avatar_media_uuid'] ?? null, 64),
            'cover_media_uuid' => $this->nullableString($input['cover_media_uuid'] ?? null, 64),
        ];
    }

    public function hydrateCommunityFromPayload(Community $community, array $payload): void
    {
        $updates = [
            'city_id' => $payload['city_id'] ?? null,
            'custom_category' => $payload['custom_category'] ?? null,
            'rules' => $payload['rules'] ?? null,
            'access_type' => ($payload['access_type'] ?? 'open') === 'request' ? 'request' : 'open',
            'contacts' => is_array($payload['contacts'] ?? null) ? $payload['contacts'] : null,
        ];

        $avatarId = $this->mediaIdFromUuid($payload['avatar_media_uuid'] ?? null);
        $coverId = $this->mediaIdFromUuid($payload['cover_media_uuid'] ?? null);
        if ($avatarId) {
            $updates['avatar_media_id'] = $avatarId;
        }
        if ($coverId) {
            $updates['cover_media_id'] = $coverId;
        }

        $community->update($updates);

        $ids = array_values(array_filter(array_map('intval', $payload['post_category_ids'] ?? [])));
        if ($ids !== []) {
            $valid = PostCategory::query()->whereIn('id', $ids)->where('is_active', true)->pluck('id')->all();
            $community->topicCategories()->sync($valid);
        }
    }

    public function ensureConversation(Community $community): Conversation
    {
        $conversation = Conversation::query()
            ->where('type', ConversationType::Community)
            ->where('community_id', $community->id)
            ->first();

        if ($conversation) {
            if ($conversation->title !== $community->name) {
                $conversation->update(['title' => $community->name]);
            }

            return $conversation;
        }

        return Conversation::create([
            'type' => ConversationType::Community,
            'community_id' => $community->id,
            'title' => $community->name,
        ]);
    }

    public function addToChat(Community $community, User $user): Conversation
    {
        $conversation = $this->ensureConversation($community);
        $existing = ConversationParticipant::query()
            ->where('conversation_id', $conversation->id)
            ->where('user_id', $user->id)
            ->first();

        if ($existing) {
            if ($existing->left_at !== null) {
                $existing->update(['left_at' => null, 'joined_at' => now()]);
            }
        } else {
            ConversationParticipant::create([
                'conversation_id' => $conversation->id,
                'user_id' => $user->id,
                'role' => 'member',
                'joined_at' => now(),
            ]);
        }

        return $conversation;
    }

    public function removeFromChat(Community $community, User $user): void
    {
        $conversation = Conversation::query()
            ->where('type', ConversationType::Community)
            ->where('community_id', $community->id)
            ->first();
        if (! $conversation) {
            return;
        }

        ConversationParticipant::query()
            ->where('conversation_id', $conversation->id)
            ->where('user_id', $user->id)
            ->update(['left_at' => now()]);
    }

    /**
     * @return array{status: string, join_request: ?CommunityJoinRequest}
     */
    public function requestOrJoin(Community $community, User $user, ?string $message = null): array
    {
        if ($community->members()->where('users.id', $user->id)->exists()) {
            $this->addToChat($community, $user);

            return ['status' => 'member', 'join_request' => null];
        }

        if (! $community->isOpen()) {
            $row = CommunityJoinRequest::query()->updateOrCreate(
                ['community_id' => $community->id, 'user_id' => $user->id],
                [
                    'status' => CommunityJoinRequest::STATUS_PENDING,
                    'message' => $this->nullableString($message, 500),
                    'reviewed_by' => null,
                    'reviewed_at' => null,
                ],
            );

            return ['status' => 'pending', 'join_request' => $row];
        }

        $community->members()->attach($user->id, [
            'role' => CommunityMemberRole::Member->value,
            'joined_at' => now(),
        ]);
        $community->increment('members_count');
        $this->addToChat($community, $user);

        return ['status' => 'member', 'join_request' => null];
    }

    public function approveJoinRequest(Community $community, CommunityJoinRequest $request, User $reviewer): void
    {
        if ((int) $request->community_id !== (int) $community->id) {
            throw new AccessDeniedHttpException('Заявка не относится к этому сообществу.');
        }

        DB::transaction(function () use ($community, $request, $reviewer): void {
            $request->update([
                'status' => CommunityJoinRequest::STATUS_APPROVED,
                'reviewed_by' => $reviewer->id,
                'reviewed_at' => now(),
            ]);

            if (! $community->members()->where('users.id', $request->user_id)->exists()) {
                $community->members()->attach($request->user_id, [
                    'role' => CommunityMemberRole::Member->value,
                    'joined_at' => now(),
                ]);
                $community->increment('members_count');
            }

            $user = User::query()->find($request->user_id);
            if ($user) {
                $this->addToChat($community, $user);
            }
        });
    }

    public function rejectJoinRequest(Community $community, CommunityJoinRequest $request, User $reviewer): void
    {
        if ((int) $request->community_id !== (int) $community->id) {
            throw new AccessDeniedHttpException('Заявка не относится к этому сообществу.');
        }

        $request->update([
            'status' => CommunityJoinRequest::STATUS_REJECTED,
            'reviewed_by' => $reviewer->id,
            'reviewed_at' => now(),
        ]);
    }

    public function banMember(Community $community, User $actor, User $target): void
    {
        if ($community->isOwnedBy($target)) {
            throw ValidationException::withMessages(['user' => ['Нельзя исключить владельца.']]);
        }
        if ((int) $actor->id === (int) $target->id) {
            throw ValidationException::withMessages(['user' => ['Нельзя исключить себя.']]);
        }

        $detached = $community->members()->detach($target->id);
        if ($detached > 0 && $community->members_count > 0) {
            $community->decrement('members_count');
        }
        $this->removeFromChat($community, $target);
        CommunityJoinRequest::query()
            ->where('community_id', $community->id)
            ->where('user_id', $target->id)
            ->delete();
    }

    public function markPostsRead(Community $community, User $user): void
    {
        $lastId = Post::query()->where('community_id', $community->id)->max('id');
        if (! $lastId) {
            return;
        }

        DB::table('community_members')
            ->where('community_id', $community->id)
            ->where('user_id', $user->id)
            ->update(['last_read_post_id' => $lastId]);
    }

    /**
     * @param  Collection<int, Community>  $communities
     */
    public function attachActivity(Collection $communities, User $viewer): void
    {
        $ids = $communities->pluck('id')->all();
        if ($ids === []) {
            return;
        }

        $memberships = DB::table('community_members')
            ->where('user_id', $viewer->id)
            ->whereIn('community_id', $ids)
            ->get(['community_id', 'last_read_post_id'])
            ->keyBy('community_id');

        $conversations = Conversation::query()
            ->where('type', ConversationType::Community)
            ->whereIn('community_id', $ids)
            ->get(['id', 'community_id'])
            ->keyBy('community_id');

        $participantRows = ConversationParticipant::query()
            ->where('user_id', $viewer->id)
            ->whereIn('conversation_id', $conversations->pluck('id'))
            ->whereNull('left_at')
            ->get(['conversation_id', 'last_read_message_id'])
            ->keyBy('conversation_id');

        $onlineLimit = now()->subSeconds(120);

        foreach ($communities as $community) {
            $membership = $memberships->get($community->id);
            $lastReadPost = $membership?->last_read_post_id;
            $unreadPosts = Post::query()
                ->where('community_id', $community->id)
                ->where('status', 'published')
                ->when($lastReadPost, fn ($q) => $q->where('id', '>', $lastReadPost))
                ->count();

            $unreadMessages = 0;
            $conversation = $conversations->get($community->id);
            if ($conversation) {
                $participant = $participantRows->get($conversation->id);
                $lastReadMsg = $participant?->last_read_message_id;
                $unreadMessages = (int) DB::table('messages')
                    ->where('conversation_id', $conversation->id)
                    ->whereNull('deleted_at')
                    ->where('user_id', '!=', $viewer->id)
                    ->when($lastReadMsg, fn ($q) => $q->where('id', '>', $lastReadMsg))
                    ->count();
            }

            $online = $community->members()
                ->where('users.id', '!=', $viewer->id)
                ->where('users.last_seen_at', '>=', $onlineLimit)
                ->with('profile.avatar')
                ->limit(3)
                ->get();

            $community->setAttribute('unread_posts', $unreadPosts);
            $community->setAttribute('unread_messages', $unreadMessages);
            $community->setAttribute('online_avatars', $online->map(fn (User $u) => [
                'uuid' => $u->uuid,
                'name' => $u->profile?->display_name ?? $u->name,
                'url' => $u->profile?->avatar?->url,
            ])->values()->all());
            $community->setAttribute('join_request_pending', CommunityJoinRequest::query()
                ->where('community_id', $community->id)
                ->where('user_id', $viewer->id)
                ->where('status', CommunityJoinRequest::STATUS_PENDING)
                ->exists());
        }
    }

    public function createEvent(Community $community, User $actor, array $data): CommunityEvent
    {
        $coverId = $this->mediaIdFromUuid($data['cover_media_uuid'] ?? null);

        return CommunityEvent::create([
            'community_id' => $community->id,
            'created_by' => $actor->id,
            'title' => trim((string) $data['title']),
            'description' => $this->nullableString($data['description'] ?? null, 4000),
            'starts_at' => $data['starts_at'],
            'location_name' => $this->nullableString($data['location_name'] ?? null, 255),
            'latitude' => isset($data['latitude']) ? (float) $data['latitude'] : null,
            'longitude' => isset($data['longitude']) ? (float) $data['longitude'] : null,
            'cover_media_id' => $coverId,
        ]);
    }

    public function toggleAttendance(CommunityEvent $event, User $user): bool
    {
        $exists = $event->attendees()->where('users.id', $user->id)->exists();
        if ($exists) {
            $event->attendees()->detach($user->id);

            return false;
        }
        $event->attendees()->attach($user->id);

        return true;
    }

    private function mediaIdFromUuid(mixed $uuid): ?int
    {
        if (! is_string($uuid) || $uuid === '') {
            return null;
        }

        return Media::query()->where('uuid', $uuid)->value('id');
    }

    private function nullableString(mixed $value, int $max): ?string
    {
        if (! is_string($value)) {
            return null;
        }
        $trimmed = trim($value);

        return $trimmed === '' ? null : mb_substr($trimmed, 0, $max);
    }
}

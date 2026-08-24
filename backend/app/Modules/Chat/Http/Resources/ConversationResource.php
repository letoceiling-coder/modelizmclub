<?php

namespace Modules\Chat\Http\Resources;

use App\Enums\ConversationType;
use App\Models\Conversation;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\User\Http\Resources\UserCompactResource;
use Modules\Chat\Services\ChatService;

/** @mixin Conversation */
class ConversationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $user = $request->user();
        $participants = $this->whenLoaded('participants', fn () => $this->participants);
        $lastMessage = match (true) {
            $this->relationLoaded('latestMessage') => $this->latestMessage,
            $this->relationLoaded('messages') => $this->messages->first(),
            default => null,
        };

        $myParticipant = $participants
            ? $this->participants->first(fn ($p) => $user && $p->user_id === $user->id)
            : null;

        $title = $this->title;
        if ($this->type === ConversationType::Direct && $user && $participants) {
            $other = $this->participants
                ->first(fn ($p) => $p->user_id !== $user->id);
            $title = $other?->user?->profile?->display_name ?? $other?->user?->name ?? 'Диалог';
        }

        return [
            'uuid' => $this->uuid,
            'type' => $this->type->value,
            'title' => $title,
            'listing_id' => $this->listing_id,
            'listing' => $this->whenLoaded('listing', fn () => $this->listing
                ? new ListingCompactResource($this->listing)
                : null),
            'is_pinned' => $myParticipant?->pinned_at !== null,
            'pinned_at' => $myParticipant?->pinned_at?->toIso8601String(),
            'pinned_message' => $this->whenLoaded('pinnedMessage', function () use ($request, $user) {
                if (! $this->pinnedMessage || ! $user) {
                    return $this->pinnedMessage ? new MessageResource($this->pinnedMessage) : null;
                }

                return app(ChatService::class)->isMessageHiddenForUser($this->pinnedMessage, $user)
                    ? null
                    : new MessageResource($this->pinnedMessage);
            }),
            'last_message_at' => $this->last_message_at?->toIso8601String(),
            'participants' => $participants
                ? $this->participants->map(fn ($p) => [
                    'user' => new UserCompactResource($p->user),
                    'role' => $p->role,
                    'pinned_at' => $p->pinned_at?->toIso8601String(),
                ])
                : [],
            'last_message' => $lastMessage && $user && ! app(ChatService::class)->isMessageHiddenForUser($lastMessage, $user)
                ? new MessageResource($lastMessage)
                : null,
            'unread_count' => $user
                ? (int) ($this->unread_count ?? app(ChatService::class)->unreadCountFor(
                    $this->resource,
                    $user,
                    $myParticipant?->last_read_message_id,
                ))
                : 0,
            'community' => $this->when(
                $this->type === ConversationType::Community && $this->relationLoaded('community'),
                fn () => $this->community ? [
                    'slug' => $this->community->slug,
                    'name' => $this->community->name,
                    'avatar' => $this->community->avatar?->url,
                ] : null,
            ),
        ];
    }
}

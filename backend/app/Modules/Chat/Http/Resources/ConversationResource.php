<?php

namespace Modules\Chat\Http\Resources;

use App\Enums\ConversationType;
use App\Http\Resources\Concerns\HasCanFlags;
use App\Models\Conversation;
use App\Models\PostCategory;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\User\Http\Resources\UserCompactResource;
use Modules\Chat\Services\ChatService;

/** @mixin Conversation */
class ConversationResource extends JsonResource
{
    use HasCanFlags;

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
            'can' => $this->canFlags($request->user(), ['view', 'send', 'delete', 'pin']),
            'type' => $this->type->value,
            'title' => $title,
            'listing_id' => $this->listing_id,
            'listing' => $this->whenLoaded('listing', fn () => $this->listing
                ? new ListingCompactResource($this->listing)
                : null),
            'deal' => $this->whenLoaded('safeDeal', fn () => [
                'uuid' => $this->safeDeal->uuid,
                'status' => $this->safeDeal->status->value,
                'status_label' => $this->safeDeal->status->label(),
            ]),
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
            'room' => $this->when(
                $this->type === ConversationType::Room && $this->post_category_id !== null,
                fn () => [
                    'category_id' => (int) $this->post_category_id,
                    'root_id' => $this->roomRootCategoryId(),
                ],
            ),
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

    /** Top-level ancestor of the room's category — the /categories/{root}/{sub} URL needs it. */
    private function roomRootCategoryId(): ?int
    {
        $current = PostCategory::query()->whereKey($this->post_category_id)->first();
        for ($depth = 0; $current && $current->parent_id !== null && $depth < 5; $depth++) {
            $current = PostCategory::query()->whereKey($current->parent_id)->first();
        }

        return $current?->id;
    }
}

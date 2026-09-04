<?php

namespace Modules\Chat\Http\Resources;

use App\Models\ConversationParticipant;
use App\Http\Resources\Concerns\HasCanFlags;
use App\Models\Message;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Chat\Http\Resources\ListingCompactResource;
use Modules\User\Http\Resources\UserCompactResource;

/** @mixin Message */
class MessageResource extends JsonResource
{
    use HasCanFlags;

    public function toArray(Request $request): array
    {
        return [
            'uuid' => $this->uuid,
            'can' => $this->canFlags($request->user(), ['delete', 'hide', 'pin']),
            'body' => $this->body,
            'type' => $this->type,
            'status' => $this->resolveStatus($request),
            // System notices have no author, so the relation can be loaded and null.
            'author' => $this->whenLoaded('author', fn () => new UserCompactResource($this->author)),
            'reply_to' => $this->whenLoaded('replyTo', fn () => $this->replyTo ? [
                'uuid' => $this->replyTo->uuid,
                'body' => $this->replyTo->body,
                'author' => new UserCompactResource($this->replyTo->author),
            ] : null),
            'forwarded_from' => $this->whenLoaded('forwardedFrom', fn () => $this->forwardedFrom ? [
                'uuid' => $this->forwardedFrom->uuid,
                'body' => $this->forwardedFrom->body,
                'author' => new UserCompactResource($this->forwardedFrom->author),
            ] : null),
            'listing' => $this->when(
                $this->type === 'listing' && $this->relationLoaded('listing') && $this->listing,
                fn () => new ListingCompactResource($this->listing),
            ),
            'post' => $this->when(
                $this->type === 'post' && $this->relationLoaded('post') && $this->post,
                fn () => new PostCompactResource($this->post),
            ),
            'attachments' => $this->whenLoaded('attachments', fn () => $this->attachments->map(fn ($attachment) => [
                'media' => $attachment->relationLoaded('media') && $attachment->media ? array_merge(
                    $attachment->media->toApiArray() ?? [
                        'uuid' => $attachment->media->uuid,
                        'url' => $attachment->media->url,
                    ],
                    [
                        'filename' => $attachment->media->filename,
                        'size_bytes' => $attachment->media->size_bytes,
                        'duration' => $attachment->media->duration_seconds,
                    ],
                ) : null,
            ])),
            'created_at' => $this->created_at->toIso8601String(),
            'edited_at' => $this->edited_at?->toIso8601String(),
        ];
    }

    private function resolveStatus(Request $request): string
    {
        $stored = $this->status ?? 'sent';
        $user = $request->user();

        if (! $user || $this->user_id !== $user->id) {
            return $stored;
        }

        $otherLastRead = $request->attributes->get('chat_other_last_read_message_id');
        if ($otherLastRead === null && $this->conversation_id) {
            $otherLastRead = ConversationParticipant::query()
                ->where('conversation_id', $this->conversation_id)
                ->where('user_id', '!=', $user->id)
                ->whereNull('left_at')
                ->value('last_read_message_id');
        }

        if ($otherLastRead !== null && $otherLastRead >= $this->id) {
            return 'read';
        }

        $otherLastSeen = $request->attributes->get('chat_other_last_seen_at');
        if ($otherLastSeen === null && $this->conversation_id) {
            $otherLastSeen = User::query()
                ->whereIn(
                    'id',
                    ConversationParticipant::query()
                        ->where('conversation_id', $this->conversation_id)
                        ->where('user_id', '!=', $user->id)
                        ->whereNull('left_at')
                        ->select('user_id'),
                )
                ->value('last_seen_at');
        }

        if ($otherLastSeen !== null && $this->created_at !== null) {
            $seenAt = $otherLastSeen instanceof Carbon
                ? $otherLastSeen
                : Carbon::parse($otherLastSeen);
            if ($seenAt->greaterThanOrEqualTo($this->created_at)) {
                return 'delivered';
            }
        }

        return 'sent';
    }
}

<?php

namespace Modules\Chat\Http\Resources;

use App\Enums\ConversationType;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\User\Http\Resources\UserCompactResource;

/** @mixin \App\Models\Conversation */
class ConversationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $user = $request->user();
        $participants = $this->whenLoaded('participants', fn () => $this->participants);
        $lastMessage = $this->relationLoaded('messages') ? $this->messages->first() : null;

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
            'last_message_at' => $this->last_message_at?->toIso8601String(),
            'participants' => $participants
                ? $this->participants->map(fn ($p) => [
                    'user' => new UserCompactResource($p->user),
                    'role' => $p->role,
                ])
                : [],
            'last_message' => $lastMessage ? new MessageResource($lastMessage) : null,
        ];
    }
}

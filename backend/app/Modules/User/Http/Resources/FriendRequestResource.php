<?php

namespace Modules\User\Http\Resources;

use App\Models\FriendRequest;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin FriendRequest */
class FriendRequestResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'status' => $this->status->value,
            'from' => new UserCompactResource($this->whenLoaded('fromUser')),
            'to' => new UserCompactResource($this->whenLoaded('toUser')),
            'created_at' => $this->created_at?->toIso8601String(),
            'responded_at' => $this->responded_at?->toIso8601String(),
        ];
    }
}

<?php

namespace Modules\Admin\Http\Resources;

use App\Models\ModerationQueue;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin ModerationQueue */
class ModerationQueueResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'queue' => $this->queue,
            'status' => $this->status,
            'priority' => $this->priority,
            'moderatable_type' => class_basename($this->moderatable_type),
            'moderatable_id' => $this->moderatable_id,
            'moderatable' => $this->whenLoaded('moderatable', fn () => $this->moderatable),
            'assigned_to' => $this->whenLoaded('assignee', fn () => [
                'uuid' => $this->assignee?->uuid,
                'name' => $this->assignee?->name,
            ]),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}

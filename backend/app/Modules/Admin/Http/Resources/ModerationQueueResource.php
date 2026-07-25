<?php

namespace Modules\Admin\Http\Resources;

use App\Models\ChannelPost;
use App\Models\ModerationQueue;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Str;

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
            'moderatable' => $this->whenLoaded('moderatable', fn () => $this->formatModeratable()),
            'assigned_to' => $this->whenLoaded('assignee', fn () => [
                'uuid' => $this->assignee?->uuid,
                'name' => $this->assignee?->name,
            ]),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }

    private function formatModeratable(): mixed
    {
        $model = $this->moderatable;

        if ($model instanceof ChannelPost) {
            $model->loadMissing(['author.profile', 'channel']);

            return [
                'uuid' => $model->uuid,
                'title' => Str::limit(trim($model->text), 80, '…') ?: 'Пост канала',
                'text' => $model->text,
                'author' => [
                    'display_name' => $model->author?->profile?->display_name ?? $model->author?->name ?? '',
                ],
                'category' => [
                    'name' => $model->channel?->name ?? 'Канал',
                ],
                'channel' => [
                    'name' => $model->channel?->name ?? '',
                ],
            ];
        }

        return $model;
    }
}

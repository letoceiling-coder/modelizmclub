<?php

namespace Modules\Chat\Http\Resources;

use App\Models\Message;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\User\Http\Resources\UserCompactResource;

/** @mixin Message */
class MessageResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'uuid' => $this->uuid,
            'body' => $this->body,
            'type' => $this->type,
            'status' => $this->status,
            'author' => new UserCompactResource($this->whenLoaded('author')),
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
            'attachments' => $this->whenLoaded('attachments', fn () => $this->attachments->map(fn ($attachment) => [
                'media' => $attachment->relationLoaded('media') && $attachment->media ? [
                    'uuid' => $attachment->media->uuid,
                    'url' => $attachment->media->url,
                    'filename' => $attachment->media->filename,
                    'mime_type' => $attachment->media->mime_type,
                    'size_bytes' => $attachment->media->size_bytes,
                    'width' => $attachment->media->width,
                    'height' => $attachment->media->height,
                    'duration' => $attachment->media->duration_seconds,
                ] : null,
            ])),
            'created_at' => $this->created_at->toIso8601String(),
            'edited_at' => $this->edited_at?->toIso8601String(),
        ];
    }
}

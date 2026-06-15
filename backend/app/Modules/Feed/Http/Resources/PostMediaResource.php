<?php

namespace Modules\Feed\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\PostMedia */
class PostMediaResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'type' => $this->type,
            'sort_order' => $this->sort_order,
            'duration_seconds' => $this->duration_seconds,
            'media' => $this->whenLoaded('media', fn () => [
                'uuid' => $this->media->uuid,
                'mime_type' => $this->media->mime_type,
                'url' => $this->media->url,
                'width' => $this->media->width,
                'height' => $this->media->height,
            ]),
        ];
    }
}

<?php

namespace Modules\Channel\Http\Resources;

use App\Models\ChannelPostMedia;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin ChannelPostMedia */
class ChannelPostMediaResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'type' => $this->type,
            'sort_order' => $this->sort_order,
            'duration_seconds' => $this->duration_seconds,
            'media' => $this->whenLoaded('media', fn () => $this->media?->toPostApiArray()),
        ];
    }
}

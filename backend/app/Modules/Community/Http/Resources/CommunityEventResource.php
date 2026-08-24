<?php

namespace Modules\Community\Http\Resources;

use App\Models\CommunityEvent;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin CommunityEvent */
class CommunityEventResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $user = $request->user('sanctum');

        return [
            'uuid' => $this->uuid,
            'title' => $this->title,
            'description' => $this->description,
            'starts_at' => $this->starts_at?->toIso8601String(),
            'location_name' => $this->location_name,
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
            'cover' => $this->whenLoaded('cover', fn () => $this->cover ? [
                'uuid' => $this->cover->uuid,
                'url' => $this->cover->url,
            ] : null),
            'attendees_count' => (int) ($this->attendees_count ?? $this->attendees()->count()),
            'going' => $user !== null && $this->relationLoaded('attendees')
                ? $this->attendees->contains(fn ($u) => (int) $u->id === (int) $user->id)
                : false,
            'map_url' => ($this->latitude && $this->longitude)
                ? 'https://www.openstreetmap.org/?mlat='.$this->latitude.'&mlon='.$this->longitude.'#map=16/'.$this->latitude.'/'.$this->longitude
                : null,
        ];
    }
}

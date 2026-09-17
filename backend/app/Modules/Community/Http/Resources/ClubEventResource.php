<?php

namespace Modules\Community\Http\Resources;

use App\Models\ClubEvent;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Gate;
use Modules\User\Http\Resources\UserCompactResource;

/**
 * Мероприятие для клиента — одно и то же для сообщества и площадки.
 *
 * `status` — то, что хранится (draft | published | cancelled);
 * `display_status` — то, что видит человек: опубликованное с началом в
 * прошлом становится `past`. Прошедшие не хранятся флагом.
 *
 * `can` считает EventPolicy — тот же код, что охраняет маршруты.
 *
 * @mixin ClubEvent
 */
class ClubEventResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $user = $request->user('sanctum');

        return [
            'uuid' => $this->uuid,
            'scope' => $this->scope,
            'status' => $this->status,
            'display_status' => $this->displayStatus(),
            'title' => $this->title,
            'description' => $this->description,
            'starts_at' => $this->starts_at?->toIso8601String(),
            'location_name' => $this->location_name,
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
            'map_url' => ($this->latitude !== null && $this->longitude !== null)
                ? 'https://www.openstreetmap.org/?mlat='.$this->latitude.'&mlon='.$this->longitude.'#map=16/'.$this->latitude.'/'.$this->longitude
                : null,
            'cover' => $this->whenLoaded('cover', fn () => $this->cover ? [
                'uuid' => $this->cover->uuid,
                'url' => $this->cover->url,
            ] : null),
            'community' => $this->when($this->community_id !== null, fn () => $this->relationLoaded('community') && $this->community ? [
                'slug' => $this->community->slug,
                'name' => $this->community->name,
                'is_open' => $this->community->isOpen(),
            ] : null),
            'creator' => $this->whenLoaded('creator', fn () => $this->creator
                ? (new UserCompactResource($this->creator))->toArray($request)
                : null),
            'cancelled_at' => $this->cancelled_at?->toIso8601String(),
            'cancel_reason' => $this->cancel_reason,
            'attendees_count' => (int) ($this->attendees_count ?? $this->attendees()->count()),
            'going' => $user !== null && (
                $this->relationLoaded('attendees')
                    ? $this->attendees->contains(fn ($u) => (int) $u->id === (int) $user->id)
                    : $this->attendees()->where('users.id', $user->id)->exists()
            ),
            'can' => [
                'update' => $user !== null && Gate::forUser($user)->allows('update', $this->resource),
                'delete' => $user !== null && Gate::forUser($user)->allows('delete', $this->resource),
                'cancel' => $user !== null && Gate::forUser($user)->allows('cancel', $this->resource),
                'attend' => $user !== null && Gate::forUser($user)->allows('attend', $this->resource),
                'manage' => $user !== null && Gate::forUser($user)->allows('manage', $this->resource),
            ],
            'created_at' => $this->created_at?->toIso8601String(),
            'deleted_at' => $this->deleted_at?->toIso8601String(),
        ];
    }
}

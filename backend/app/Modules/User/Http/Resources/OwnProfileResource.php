<?php

namespace Modules\User\Http\Resources;

use App\Models\UserProfile;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin UserProfile */
class OwnProfileResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return array_merge(
            (new PublicProfileResource($this->resource))->toArray($request),
            [
                'city_id' => $this->city_id,
                'avatar_media_id' => $this->avatar_media_id,
                'cover_media_id' => $this->cover_media_id,
                'cover' => $this->whenLoaded('cover', fn () => $this->cover ? [
                    'uuid' => $this->cover->uuid,
                    'url' => $this->cover->url ?? null,
                ] : null),
                'phone' => $this->user?->phone,
                'vk_url' => $this->vk_url,
                'telegram_url' => $this->telegram_url,
                'website_url' => $this->website_url,
                'privacy_settings' => array_merge(
                    UserProfile::DEFAULT_PRIVACY,
                    $this->privacy_settings ?? [],
                ),
            ],
        );
    }
}

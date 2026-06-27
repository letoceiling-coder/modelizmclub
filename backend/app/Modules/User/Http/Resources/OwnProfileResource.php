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
                'privacy_settings' => array_merge(
                    UserProfile::DEFAULT_PRIVACY,
                    $this->privacy_settings ?? [],
                ),
            ],
        );
    }
}

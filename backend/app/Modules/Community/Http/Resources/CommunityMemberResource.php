<?php

namespace Modules\Community\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\User\Http\Resources\UserCompactResource;

/** @mixin User */
class CommunityMemberResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return array_merge(
            (new UserCompactResource($this->resource))->toArray($request),
            [
                'role' => $this->pivot->role,
                'joined_at' => $this->pivot->joined_at,
            ],
        );
    }
}

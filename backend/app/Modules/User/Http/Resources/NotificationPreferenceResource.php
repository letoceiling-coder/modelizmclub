<?php

namespace Modules\User\Http\Resources;

use App\Models\NotificationPreference;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin NotificationPreference */
class NotificationPreferenceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'channel' => $this->channel,
            'type' => $this->type,
            'enabled' => $this->enabled,
        ];
    }
}

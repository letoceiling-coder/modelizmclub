<?php

namespace App\Http\Resources;

use App\Models\ChannelApplication;
use App\Models\CommunityApplication;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Unified shape for channel/community creation applications, matching the
 * frontend `EntityRequest` contract (backend-endpoints-needed.md §27).
 *
 * @mixin CommunityApplication|ChannelApplication
 */
class EntityRequestResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $isChannel = $this->resource instanceof ChannelApplication;
        $applicant = $this->user;

        return [
            'id' => (string) $this->id,
            'kind' => $isChannel ? 'channel' : 'community',
            'proposedName' => $this->proposed_name,
            'description' => $this->description,
            'category' => $isChannel
                ? ($this->category ?? '')
                : ($this->category?->name ?? ''),
            'status' => $this->status->value,
            'createdAt' => $this->created_at?->toIso8601String(),
            'applicant' => [
                'id' => (string) ($applicant?->uuid ?? ''),
                'name' => $applicant?->profile?->display_name ?? $applicant?->name ?? '',
                'slug' => $applicant?->profile?->slug,
            ],
        ];
    }
}

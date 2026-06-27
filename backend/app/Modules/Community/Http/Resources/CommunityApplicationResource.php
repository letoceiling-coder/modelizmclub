<?php

namespace Modules\Community\Http\Resources;

use App\Models\CommunityApplication;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin CommunityApplication */
class CommunityApplicationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'proposed_name' => $this->proposed_name,
            'description' => $this->description,
            'category_id' => $this->category_id,
            'status' => $this->status->value,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}

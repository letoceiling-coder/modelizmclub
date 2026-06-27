<?php

namespace Modules\Admin\Http\Resources;

use App\Models\Report;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Report */
class ReportResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'reason' => $this->reason,
            'description' => $this->description,
            'status' => $this->status,
            'reportable_type' => class_basename($this->reportable_type),
            'reportable_id' => $this->reportable_id,
            'reporter' => $this->whenLoaded('reporter', fn () => [
                'uuid' => $this->reporter?->uuid,
                'email' => $this->reporter?->email,
            ]),
            'created_at' => $this->created_at?->toIso8601String(),
            'resolved_at' => $this->resolved_at?->toIso8601String(),
        ];
    }
}

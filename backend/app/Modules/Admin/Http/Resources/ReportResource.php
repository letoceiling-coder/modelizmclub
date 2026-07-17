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
        $typeKey = strtolower(class_basename($this->reportable_type ?? ''));

        return [
            'id' => $this->id,
            'reason' => $this->reason,
            'description' => $this->description,
            'status' => $this->status,
            'target_type' => $typeKey,
            'target_uuid' => $this->when(
                $this->relationLoaded('reportable') && $this->reportable !== null,
                fn () => $this->reportable->uuid ?? null,
            ),
            'reporter' => $this->whenLoaded('reporter', fn () => [
                'uuid' => $this->reporter?->uuid,
                'name' => $this->reporter?->name ?? $this->reporter?->email,
                'email' => $this->reporter?->email,
            ]),
            'resolver' => $this->whenLoaded('resolver', fn () => $this->resolver ? [
                'uuid' => $this->resolver->uuid,
                'email' => $this->resolver->email,
            ] : null),
            'created_at' => $this->created_at?->toIso8601String(),
            'resolved_at' => $this->resolved_at?->toIso8601String(),
        ];
    }
}

<?php

namespace Modules\Legal\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\FooterLink;
use Illuminate\Http\JsonResponse;

class FooterLinksController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $links = FooterLink::query()
            ->where('is_visible', true)
            ->orderBy('group')
            ->orderBy('sort')
            ->get();

        $grouped = $links->groupBy('group')->map(
            fn ($items) => $items->map(fn (FooterLink $link) => [
                'id' => $link->id,
                'label' => $link->label,
                'target_type' => $link->target_type,
                'target_value' => $link->target_value,
                'sort' => $link->sort,
            ])->values()
        );

        return response()->json(['data' => $grouped]);
    }
}

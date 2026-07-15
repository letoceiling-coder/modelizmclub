<?php

namespace Modules\PublicContent\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SystemSetting;
use Illuminate\Http\JsonResponse;

class IconOverridesController extends Controller
{
    /**
     * Public map of icon slot overrides published from /admin
     * (backend-endpoints-needed.md §26). Empty object when nothing published.
     */
    public function __invoke(): JsonResponse
    {
        $setting = SystemSetting::query()->where('key', 'icon_overrides')->first();
        $map = $setting?->value;

        return response()->json([
            'data' => is_array($map) && $map !== [] ? $map : new \stdClass(),
        ]);
    }
}

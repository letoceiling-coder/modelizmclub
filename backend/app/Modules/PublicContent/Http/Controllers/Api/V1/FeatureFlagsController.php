<?php

namespace Modules\PublicContent\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SystemSetting;
use Illuminate\Http\JsonResponse;

class FeatureFlagsController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $setting = SystemSetting::query()->where('key', 'feature.communities_enabled')->first();
        $enabled = (bool) ($setting?->value['enabled'] ?? false);

        return response()->json([
            'data' => [
                'communities_enabled' => $enabled,
            ],
        ]);
    }
}

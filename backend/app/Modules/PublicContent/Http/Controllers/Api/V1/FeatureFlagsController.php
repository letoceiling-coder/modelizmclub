<?php

namespace Modules\PublicContent\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SystemSetting;
use Illuminate\Http\JsonResponse;

class FeatureFlagsController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $communities = SystemSetting::query()->where('key', 'feature.communities_enabled')->first();
        $market = SystemSetting::query()->where('key', 'feature.market_enabled')->first();

        return response()->json([
            'data' => [
                'communities_enabled' => (bool) ($communities?->value['enabled'] ?? false),
                // Traffic is meant to go to listings, not be split across an
                // external marketplace link — off by default, toggleable from
                // /admin without a frontend deploy.
                'market_enabled' => (bool) ($market?->value['enabled'] ?? false),
            ],
        ]);
    }
}

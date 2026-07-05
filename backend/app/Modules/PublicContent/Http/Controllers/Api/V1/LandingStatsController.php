<?php

namespace Modules\PublicContent\Http\Controllers\Api\V1;

use App\Enums\CommunityStatus;
use App\Http\Controllers\Controller;
use App\Models\Community;
use App\Models\ListingCategory;
use App\Models\User;
use Illuminate\Http\JsonResponse;

class LandingStatsController extends Controller
{
    public function __invoke(): JsonResponse
    {
        return response()->json([
            'data' => [
                'users' => User::query()->count(),
                'communities' => Community::query()->where('status', CommunityStatus::Active)->count(),
                'listing_categories' => ListingCategory::query()
                    ->whereNull('parent_id')
                    ->where('is_active', true)
                    ->count(),
            ],
        ]);
    }
}

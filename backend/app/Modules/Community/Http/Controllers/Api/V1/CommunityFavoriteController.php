<?php

namespace Modules\Community\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Community\Services\CommunityEngagementService;
use Modules\Community\Services\CommunityService;

class CommunityFavoriteController extends Controller
{
    public function store(
        string $slug,
        Request $request,
        CommunityService $communities,
        CommunityEngagementService $engagement,
    ): JsonResponse {
        $community = $communities->findActiveBySlug($slug);
        $this->authorize('favorite', $community);

        $engagement->addFavorite($request->user(), $community);

        return response()->json([
            'data' => ['is_favorite' => true],
            'message' => 'Добавлено в избранное.',
        ]);
    }

    public function destroy(
        string $slug,
        Request $request,
        CommunityService $communities,
        CommunityEngagementService $engagement,
    ): JsonResponse {
        $community = $communities->findActiveBySlug($slug);
        $this->authorize('favorite', $community);

        $engagement->removeFavorite($request->user(), $community);

        return response()->json([
            'data' => ['is_favorite' => false],
            'message' => 'Убрано из избранного.',
        ]);
    }
}

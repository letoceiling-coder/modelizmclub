<?php

namespace Modules\Community\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Modules\Community\Http\Resources\CommunityResource;
use Modules\Community\Services\CommunityEngagementService;
use Modules\Community\Services\CommunityService;

/**
 * Похожие сообщества.
 *
 * Единственный из новых адресов без policy, и это осознанно: он отдаёт ровно
 * то, что уже отдаёт публичный GET /communities, только отфильтрованное по
 * совпадению категорий. Правило доступа здесь одно — само сообщество должно
 * быть живым, и его проверяет findActiveBySlug. Политика, всегда
 * возвращающая true, была бы комментарием, а не проверкой.
 */
class SimilarCommunitiesController extends Controller
{
    public function __invoke(
        string $slug,
        CommunityService $communities,
        CommunityEngagementService $engagement,
    ): JsonResponse {
        $community = $communities->findActiveBySlug($slug);

        return response()->json([
            'data' => CommunityResource::collection(
                $engagement->similar($community, CommunityEngagementService::SIMILAR_LIMIT),
            ),
        ]);
    }
}

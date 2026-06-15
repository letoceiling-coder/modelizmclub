<?php

namespace Modules\Community\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Community\Http\Resources\CommunityMemberResource;
use Modules\Community\Services\CommunityService;

class CommunityMembersController extends Controller
{
    public function __invoke(string $slug, Request $request, CommunityService $communities): JsonResponse
    {
        $community = $communities->findActiveBySlug($slug);
        $paginator = $communities->members($community, $request->integer('per_page', 30));

        return CommunityMemberResource::collection($paginator)->response();
    }
}

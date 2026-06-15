<?php

namespace Modules\Community\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Community\Services\CommunityService;
use Modules\Feed\Http\Resources\PostResource;
use Modules\Feed\Services\FeedService;

class CommunityPostsController extends Controller
{
    public function __invoke(string $slug, Request $request, CommunityService $communities, FeedService $feed): JsonResponse
    {
        $community = $communities->findActiveBySlug($slug);

        return PostResource::collection(
            $feed->listForCommunity($community->id, $request->user(), $request->integer('per_page', 20)),
        )->response();
    }
}

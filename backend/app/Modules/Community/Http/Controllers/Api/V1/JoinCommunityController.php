<?php

namespace Modules\Community\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Community\Services\CommunityService;

class JoinCommunityController extends Controller
{
    public function __invoke(string $slug, Request $request, CommunityService $communities): JsonResponse
    {
        $community = $communities->findActiveBySlug($slug);
        $communities->join($request->user(), $community);

        return response()->json(['message' => 'Вы вступили в сообщество.']);
    }
}

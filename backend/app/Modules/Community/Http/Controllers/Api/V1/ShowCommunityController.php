<?php

namespace Modules\Community\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Community\Http\Resources\CommunityResource;
use Modules\Community\Services\CommunityService;

class ShowCommunityController extends Controller
{
    public function __invoke(string $slug, Request $request, CommunityService $communities): JsonResponse
    {
        $community = $communities->show($slug, $request->user());

        return response()->json([
            'data' => new CommunityResource($community),
        ]);
    }
}

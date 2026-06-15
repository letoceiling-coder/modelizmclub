<?php

namespace Modules\Community\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Community\Http\Resources\CommunityResource;
use Modules\Community\Services\CommunityService;

class IndexCommunityController extends Controller
{
    public function __invoke(Request $request, CommunityService $communities): JsonResponse
    {
        $paginator = $communities->list([
            'category_id' => $request->integer('category_id') ?: null,
            'q' => $request->string('q')->toString() ?: null,
            'official' => $request->has('official') ? $request->boolean('official') : null,
        ], $request->integer('per_page', 20));

        return CommunityResource::collection($paginator)->response();
    }
}

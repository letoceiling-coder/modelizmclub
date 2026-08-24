<?php

namespace Modules\Community\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Modules\Community\Http\Requests\ApplyCommunityRequest;
use Modules\Community\Http\Resources\CommunityApplicationResource;
use Modules\Community\Services\CommunityHubService;
use Modules\Community\Services\CommunityService;

class ApplyCommunityController extends Controller
{
    public function __invoke(ApplyCommunityRequest $request, CommunityService $communities, CommunityHubService $hub): JsonResponse
    {
        $payload = $hub->applyPayloadFromRequest($request->validated());
        $categoryId = $communities->resolveCategoryId($request->integer('category_id') ?: null);

        $application = $communities->apply(
            user: $request->user(),
            proposedName: $request->string('proposed_name')->toString(),
            description: $request->string('description')->toString() ?: null,
            categoryId: $categoryId,
            payload: $payload,
        );

        return response()->json([
            'data' => new CommunityApplicationResource($application),
        ], 201);
    }
}

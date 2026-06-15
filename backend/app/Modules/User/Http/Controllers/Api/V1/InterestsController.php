<?php

namespace Modules\User\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\User\Http\Requests\SyncInterestsRequest;
use Modules\User\Http\Resources\PostCategoryResource;
use Modules\User\Services\UserService;

class InterestsController extends Controller
{
    public function show(Request $request, UserService $users): JsonResponse
    {
        return response()->json([
            'data' => PostCategoryResource::collection(
                $users->getInterests($request->user()),
            ),
        ]);
    }

    public function sync(SyncInterestsRequest $request, UserService $users): JsonResponse
    {
        $interests = $users->syncInterests(
            $request->user(),
            $request->validated('category_ids'),
        );

        return response()->json([
            'data' => PostCategoryResource::collection($interests),
        ]);
    }
}

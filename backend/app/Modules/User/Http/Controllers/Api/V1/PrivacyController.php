<?php

namespace Modules\User\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Modules\User\Http\Requests\UpdatePrivacyRequest;
use Modules\User\Http\Resources\OwnProfileResource;
use Modules\User\Services\UserService;

class PrivacyController extends Controller
{
    public function __invoke(UpdatePrivacyRequest $request, UserService $users): JsonResponse
    {
        $profile = $users->updatePrivacy($request->user(), $request->validated());

        return response()->json([
            'data' => new OwnProfileResource($profile),
        ]);
    }
}

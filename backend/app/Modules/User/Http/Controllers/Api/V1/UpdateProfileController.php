<?php

namespace Modules\User\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Modules\User\Http\Requests\UpdateProfileRequest;
use Modules\User\Http\Resources\OwnProfileResource;
use Modules\User\Services\UserService;

class UpdateProfileController extends Controller
{
    public function __invoke(UpdateProfileRequest $request, UserService $users): JsonResponse
    {
        $profile = $users->updateProfile($request->user(), $request->validated());

        return response()->json([
            'data' => new OwnProfileResource($profile),
        ]);
    }
}

<?php

namespace Modules\User\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\User\Http\Resources\OwnProfileResource;

/**
 * The current user's own profile. Until this existed, `GET /users/me` fell
 * through to the public `{slug}` catch-all and was looked up as a profile
 * named "me" — which ended in a 500 rather than a 401.
 */
class ShowMeController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $profile = $request->user()
            ->profile()
            ->with(['user', 'city', 'avatar', 'cover'])
            ->firstOrFail();

        return response()->json([
            'data' => new OwnProfileResource($profile),
        ]);
    }
}

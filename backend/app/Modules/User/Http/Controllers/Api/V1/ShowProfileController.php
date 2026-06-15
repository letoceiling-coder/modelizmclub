<?php

namespace Modules\User\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\User\Http\Resources\PublicProfileResource;
use Modules\User\Services\UserService;

class ShowProfileController extends Controller
{
    public function __invoke(string $slug, Request $request, UserService $users): JsonResponse
    {
        $profile = $users->getPublicProfile($slug, $request->user());

        return response()->json([
            'data' => new PublicProfileResource($profile),
        ]);
    }
}

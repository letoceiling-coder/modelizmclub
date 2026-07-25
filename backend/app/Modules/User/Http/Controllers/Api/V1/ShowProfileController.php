<?php

namespace Modules\User\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Modules\User\Http\Resources\PublicProfileResource;
use Modules\User\Services\UserService;

class ShowProfileController extends Controller
{
    public function __invoke(string $slug, Request $request, UserService $users): JsonResponse
    {
        // Public route — optional Sanctum token (default guard is "web" and ignores Bearer).
        $viewer = Auth::guard('sanctum')->user();
        $profile = $users->getPublicProfile($slug, $viewer);

        return response()->json([
            'data' => new PublicProfileResource($profile),
        ]);
    }
}

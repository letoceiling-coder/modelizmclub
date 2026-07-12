<?php

namespace Modules\User\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Modules\User\Services\UserRatingService;

class UserRatingController extends Controller
{
    public function __invoke(int $id, UserRatingService $ratings): JsonResponse
    {
        return response()->json($ratings->aggregate($id));
    }
}

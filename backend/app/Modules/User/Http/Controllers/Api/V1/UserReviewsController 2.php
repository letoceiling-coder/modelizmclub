<?php

namespace Modules\User\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\User\Services\UserRatingService;

class UserReviewsController extends Controller
{
    public function __invoke(int $id, Request $request, UserRatingService $ratings): JsonResponse
    {
        $perPage = min(100, max(1, (int) $request->query('per_page', 20)));

        return response()->json($ratings->listReviews($id, $perPage));
    }
}

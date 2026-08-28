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
        $sort = (string) $request->query('sort', 'new');
        if (! in_array($sort, ['new', 'high', 'low'], true)) {
            $sort = 'new';
        }

        return response()->json($ratings->listReviews($id, $perPage, $sort));
    }

    public function reply(string $uuid, Request $request, UserRatingService $ratings): JsonResponse
    {
        $data = $request->validate(['reply' => ['nullable', 'string', 'max:2000']]);

        $review = $ratings->reply((int) $request->user()->id, $uuid, $data['reply'] ?? null);

        return response()->json([
            'data' => [
                'id' => $review->uuid,
                'reply' => $review->reply,
                'replied_at' => $review->replied_at?->toIso8601String(),
            ],
        ]);
    }
}

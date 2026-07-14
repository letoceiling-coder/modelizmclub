<?php

namespace Modules\User\Services;

use App\Models\UserReview;

class UserRatingService
{
    /** @return array{average: float, count: int} */
    public function aggregate(int $userId): array
    {
        $avg = UserReview::query()->where('target_user_id', $userId)->avg('rating');

        return [
            'average' => round((float) ($avg ?? 0), 2),
            'count' => UserReview::query()->where('target_user_id', $userId)->count(),
        ];
    }

    /** @return array{data: list<array<string, mixed>>} */
    public function listReviews(int $userId, int $perPage = 20): array
    {
        $rows = UserReview::query()
            ->with(['author.profile'])
            ->where('target_user_id', $userId)
            ->orderByDesc('created_at')
            ->limit($perPage)
            ->get();

        return [
            'data' => $rows->map(fn (UserReview $review) => [
                'id' => $review->uuid,
                'author' => [
                    'id' => $review->author_id,
                    'display_name' => $review->author?->profile?->display_name ?? $review->author?->name,
                ],
                'rating' => $review->rating,
                'text' => $review->text,
                'date' => $review->created_at->toIso8601String(),
            ])->all(),
        ];
    }
}

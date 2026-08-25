<?php

namespace Modules\User\Services;

use App\Enums\SafeDealStatus;
use App\Models\UserReview;

class UserRatingService
{
    /** @return array{average: float, count: int} */
    public function aggregate(int $userId): array
    {
        $query = $this->completedDealReviews()->where('target_user_id', $userId);
        $avg = (clone $query)->avg('rating');

        return [
            'average' => round((float) ($avg ?? 0), 2),
            'count' => (clone $query)->count(),
        ];
    }

    /** @return array{data: list<array<string, mixed>>} */
    public function listReviews(int $userId, int $perPage = 20): array
    {
        $rows = $this->completedDealReviews()
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
                'safe_deal_id' => $review->safe_deal_id,
            ])->all(),
        ];
    }

    private function completedDealReviews()
    {
        return UserReview::query()
            ->whereNotNull('safe_deal_id')
            ->whereHas('safeDeal', fn ($q) => $q->where('status', SafeDealStatus::Completed));
    }
}

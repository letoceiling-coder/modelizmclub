<?php

namespace Modules\User\Services;

use App\Enums\SafeDealStatus;
use App\Models\SafeDeal;
use App\Models\UserProfile;
use App\Models\UserReview;

class UserRatingService
{
    /** A seller is "надёжный" once the score holds up over a meaningful sample. */
    public const TRUSTED_MIN_RATING = 4.5;

    public const TRUSTED_MIN_REVIEWS = 10;

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

    /**
     * Denormalise the rating onto user_profiles so listing and profile
     * payloads can expose it without re-aggregating reviews per row.
     */
    public function sync(int $userId): void
    {
        $aggregate = $this->aggregate($userId);

        UserProfile::query()->where('user_id', $userId)->update([
            'rating_score' => $aggregate['average'],
            'reviews_count' => $aggregate['count'],
            'deals_count' => SafeDeal::query()
                ->where('status', SafeDealStatus::Completed)
                ->where(fn ($q) => $q->where('seller_id', $userId)->orWhere('buyer_id', $userId))
                ->count(),
        ]);
    }

    public static function isTrusted(float $rating, int $reviews): bool
    {
        return $rating >= self::TRUSTED_MIN_RATING && $reviews >= self::TRUSTED_MIN_REVIEWS;
    }

    /**
     * @param  'new'|'high'|'low'  $sort
     * @return array{data: list<array<string, mixed>>}
     */
    public function listReviews(int $userId, int $perPage = 20, string $sort = 'new'): array
    {
        $query = $this->completedDealReviews()
            ->with(['author.profile'])
            ->where('target_user_id', $userId);

        match ($sort) {
            'high' => $query->orderByDesc('rating')->orderByDesc('created_at'),
            'low' => $query->orderBy('rating')->orderByDesc('created_at'),
            default => $query->orderByDesc('created_at'),
        };

        $rows = $query->limit($perPage)->get();

        return [
            'data' => $rows->map(fn (UserReview $review) => [
                'id' => $review->uuid,
                'author' => [
                    'id' => $review->author_id,
                    'display_name' => $review->author?->profile?->display_name ?? $review->author?->name,
                ],
                'rating' => $review->rating,
                'text' => $review->text,
                'reply' => $review->reply,
                'replied_at' => $review->replied_at?->toIso8601String(),
                'date' => $review->created_at->toIso8601String(),
                'safe_deal_id' => $review->safe_deal_id,
            ])->all(),
        ];
    }

    /** The rated user answers a review left about them. */
    public function reply(int $userId, string $reviewUuid, ?string $reply): UserReview
    {
        $review = UserReview::query()
            ->where('uuid', $reviewUuid)
            ->where('target_user_id', $userId)
            ->firstOrFail();

        $text = $reply !== null ? trim($reply) : '';

        $review->update([
            'reply' => $text === '' ? null : $text,
            'replied_at' => $text === '' ? null : now(),
        ]);

        return $review->fresh();
    }

    private function completedDealReviews()
    {
        return UserReview::query()
            ->whereNotNull('safe_deal_id')
            ->whereHas('safeDeal', fn ($q) => $q->where('status', SafeDealStatus::Completed));
    }
}

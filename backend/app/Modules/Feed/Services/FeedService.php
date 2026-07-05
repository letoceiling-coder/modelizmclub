<?php

namespace Modules\Feed\Services;

use App\Enums\ContentStatus;
use App\Models\Post;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

class FeedService
{
    public function __construct(
        private readonly PostService $posts,
    ) {}

    public function list(array $filters, ?User $viewer, int $perPage = 20): LengthAwarePaginator
    {
        $filter = $filters['filter'] ?? 'all';

        $query = Post::query()
            ->with($this->posts->defaultRelations())
            ->visibleTo($viewer)
            ->where('status', ContentStatus::Published);

        // Reposts are meaningful in the "following" tab (you want to see what the
        // people you follow shared). In the global/category/discovery feed they
        // only duplicate originals and flood the timeline, so hide them there.
        if ($filter !== 'following') {
            $query->whereNull('repost_of_id');
        }

        if ($filter === 'following') {
            if (! $viewer) {
                return Post::query()->whereRaw('1 = 0')->paginate($perPage);
            }

            $followingIds = $viewer->following()->pluck('users.id');

            $query->whereIn('user_id', $followingIds);
        }

        if ($filter === 'category' && ! empty($filters['category_id'])) {
            $query->where('category_id', (int) $filters['category_id']);
        }

        // category_id может приходить и вне режима "category" — как дополнительный фильтр.
        if ($filter !== 'category' && ! empty($filters['category_id'])) {
            $query->where('category_id', (int) $filters['category_id']);
        }

        if (! empty($filters['community_id'])) {
            $query->where('community_id', (int) $filters['community_id']);
        }

        if (! empty($filters['author_id'])) {
            $query->where('user_id', (int) $filters['author_id']);
        }

        if (! empty($filters['q'])) {
            $term = $filters['q'];
            $query->where(function ($q) use ($term): void {
                $q->where('title', 'ilike', "%{$term}%")
                    ->orWhere('body', 'ilike', "%{$term}%");
            });
        }

        if (! empty($filters['hashtag'])) {
            $tag = ltrim((string) $filters['hashtag'], '#');
            $query->whereHas('tags', function ($q) use ($tag): void {
                $q->where('name', 'ilike', $tag)->orWhere('slug', 'ilike', $tag);
            });
        }

        if (($filters['has_media'] ?? null) === true) {
            $query->whereHas('mediaItems');
        } elseif (($filters['has_media'] ?? null) === false) {
            $query->whereDoesntHave('mediaItems');
        }

        if (! empty($filters['date_from'])) {
            $query->where('published_at', '>=', $filters['date_from']);
        }

        if (! empty($filters['date_to'])) {
            $query->where('published_at', '<=', $filters['date_to']);
        }

        $this->applySort($query, $filters['sort'] ?? 'new');

        $paginator = $query->paginate($perPage);

        $this->posts->attachViewerFlagsToCollection($paginator->getCollection(), $viewer);

        return $paginator;
    }

    /**
     * Варианты сортировки ленты: new (по дате), popular (реакции),
     * discussed (комментарии), viewed (просмотры).
     *
     * @param  Builder<Post>  $query
     */
    private function applySort($query, ?string $sort): void
    {
        match ($sort) {
            'popular' => $query->orderByDesc('reactions_count')->orderByDesc('published_at'),
            'discussed' => $query->orderByDesc('comments_count')->orderByDesc('published_at'),
            'viewed' => $query->orderByDesc('views_count')->orderByDesc('published_at'),
            'oldest' => $query->orderBy('published_at'),
            default => $query->orderByDesc('published_at'),
        };
    }

    public function listForCommunity(int $communityId, ?User $viewer, int $perPage = 20): LengthAwarePaginator
    {
        return $this->list([
            'filter' => 'all',
            'community_id' => $communityId,
        ], $viewer, $perPage);
    }
}

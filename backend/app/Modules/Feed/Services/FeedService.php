<?php

namespace Modules\Feed\Services;

use App\Enums\ContentStatus;
use App\Models\Post;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

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
            ->where('status', ContentStatus::Published)
            ->orderByDesc('published_at');

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

        if (! empty($filters['community_id'])) {
            $query->where('community_id', (int) $filters['community_id']);
        }

        if (! empty($filters['author_id'])) {
            $query->where('user_id', (int) $filters['author_id']);
        }

        $paginator = $query->paginate($perPage);

        $this->posts->attachViewerFlagsToCollection($paginator->getCollection(), $viewer);

        return $paginator;
    }

    public function listForCommunity(int $communityId, ?User $viewer, int $perPage = 20): LengthAwarePaginator
    {
        return $this->list([
            'filter' => 'all',
            'community_id' => $communityId,
        ], $viewer, $perPage);
    }
}

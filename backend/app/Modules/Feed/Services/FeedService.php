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

        $paginator = $query->paginate($perPage);

        $paginator->getCollection()->each(
            fn (Post $post) => $this->posts->attachViewerFlags($post, $viewer),
        );

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

<?php

namespace Modules\Channel\Services;

use App\Models\ChannelPost;
use App\Models\ChannelPostLike;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Modules\Feed\Services\PostInteractionService;

class ChannelPostInteractionService
{
    public function __construct(
        private readonly PostInteractionService $feedInteractions,
        private readonly ChannelPostViewLedger $views,
    ) {}

    public function like(ChannelPost $post, User $user): ChannelPost
    {
        if ($post->status !== 'published') {
            abort(422, 'Нельзя поставить реакцию неопубликованному посту.');
        }

        $post->loadMissing('feedPost');

        if ($post->feedPost) {
            $this->feedInteractions->react($post->feedPost, $user, 'like');
            $this->syncLikesFromFeed($post);

            return $post->fresh() ?? $post;
        }

        $created = ChannelPostLike::query()->firstOrCreate([
            'channel_post_id' => $post->id,
            'user_id' => $user->id,
        ]);

        if ($created->wasRecentlyCreated) {
            $post->increment('likes_count');
        }

        $post->viewer_liked = true;

        return $post->fresh() ?? $post;
    }

    public function unlike(ChannelPost $post, User $user): ChannelPost
    {
        $post->loadMissing('feedPost');

        if ($post->feedPost) {
            $this->feedInteractions->removeReaction($post->feedPost, $user);
            $this->syncLikesFromFeed($post);

            return $post->fresh() ?? $post;
        }

        $deleted = ChannelPostLike::query()
            ->where('channel_post_id', $post->id)
            ->where('user_id', $user->id)
            ->delete();

        if ($deleted > 0 && $post->likes_count > 0) {
            $post->decrement('likes_count');
        }

        $post->viewer_liked = false;

        return $post->fresh() ?? $post;
    }

    /**
     * Count one unique view for an authenticated user or a valid guest session.
     * Owner/manager views and unpublished posts are ignored. Книга общая с
     * зеркалом в ленте — см. ChannelPostViewLedger.
     */
    public function recordView(ChannelPost $post, ?User $viewer, Request $request): bool
    {
        return $this->views->record($post, $viewer, $request);
    }

    public function pin(ChannelPost $post): ChannelPost
    {
        $post->update(['pinned_at' => now()]);

        return $post->fresh() ?? $post;
    }

    public function unpin(ChannelPost $post): ChannelPost
    {
        $post->update(['pinned_at' => null]);

        return $post->fresh() ?? $post;
    }

    public function syncLikesFromFeed(ChannelPost $post): void
    {
        $post->loadMissing('feedPost');
        if (! $post->feedPost) {
            return;
        }

        $post->update(['likes_count' => (int) $post->feedPost->reactions_count]);
    }

    /**
     * @param  Collection<int, ChannelPost>  $posts
     */
    public function attachViewerState($posts, ?User $viewer): void
    {
        if ($viewer === null) {
            $posts->each(function (ChannelPost $post): void {
                $post->viewer_liked = false;
            });

            return;
        }

        $ids = $posts->pluck('id')->filter()->values()->all();
        if ($ids === []) {
            return;
        }

        $likedDirect = array_flip(
            ChannelPostLike::query()
                ->where('user_id', $viewer->id)
                ->whereIn('channel_post_id', $ids)
                ->pluck('channel_post_id')
                ->all(),
        );

        $feedIds = $posts->pluck('feed_post_id')->filter()->values()->all();
        $likedFeed = $feedIds === []
            ? []
            : array_flip(
                DB::table('post_reactions')
                    ->where('user_id', $viewer->id)
                    ->whereIn('post_id', $feedIds)
                    ->pluck('post_id')
                    ->all(),
            );

        $posts->each(function (ChannelPost $post) use ($likedDirect, $likedFeed): void {
            $post->viewer_liked = isset($likedDirect[$post->id])
                || ($post->feed_post_id && isset($likedFeed[$post->feed_post_id]));
        });
    }
}

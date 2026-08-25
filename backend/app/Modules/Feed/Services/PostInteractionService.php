<?php

namespace Modules\Feed\Services;

use App\Models\ChannelPost;
use App\Models\Post;
use App\Models\PostReaction;
use App\Models\User;
use App\Notifications\InAppNotification;
use App\Services\InAppNotify;
use App\Support\UserLabel;
use Illuminate\Support\Facades\DB;
use Modules\Feed\Support\PostInteractionRules;

class PostInteractionService
{
    public function react(Post $post, User $user, string $type = 'like'): Post
    {
        PostInteractionRules::assertPublicInteractionsAllowed($post);

        $created = PostReaction::query()->firstOrCreate(
            ['post_id' => $post->id, 'user_id' => $user->id],
            ['type' => $type],
        );

        if ($created->wasRecentlyCreated) {
            $post->increment('reactions_count');
            $this->notifyLike($post, $user);
        } elseif ($created->type !== $type) {
            $created->update(['type' => $type]);
        }

        $fresh = $post->fresh() ?? $post;
        $this->syncLinkedChannelPostLikes($fresh);

        return $fresh;
    }

    public function removeReaction(Post $post, User $user): Post
    {
        PostInteractionRules::assertPublicInteractionsAllowed($post);

        $deleted = PostReaction::query()
            ->where('post_id', $post->id)
            ->where('user_id', $user->id)
            ->delete();

        if ($deleted) {
            $post->decrement('reactions_count');
        }

        $fresh = $post->fresh() ?? $post;
        $this->syncLinkedChannelPostLikes($fresh);

        return $fresh;
    }

    public function bookmark(Post $post, User $user): void
    {
        PostInteractionRules::assertPublicInteractionsAllowed($post);

        DB::table('post_bookmarks')->insertOrIgnore([
            'user_id' => $user->id,
            'post_id' => $post->id,
            'created_at' => now(),
        ]);
    }

    public function removeBookmark(Post $post, User $user): void
    {
        PostInteractionRules::assertPublicInteractionsAllowed($post);

        DB::table('post_bookmarks')
            ->where('user_id', $user->id)
            ->where('post_id', $post->id)
            ->delete();
    }

    public function repost(Post $original, User $user): Post
    {
        PostInteractionRules::assertPublicInteractionsAllowed($original);

        // Idempotent: if the user already reposted this one, return their
        // existing repost instead of stacking duplicates.
        $existing = DB::table('post_reposts')
            ->where('user_id', $user->id)
            ->where('original_post_id', $original->id)
            ->whereNotNull('repost_post_id')
            ->value('repost_post_id');

        if ($existing) {
            return Post::query()->findOrFail($existing);
        }

        return DB::transaction(function () use ($original, $user): Post {
            $repost = Post::create([
                'user_id' => $user->id,
                'category_id' => $original->category_id,
                'community_id' => $original->community_id,
                'title' => $original->title,
                'body' => '',
                'status' => $original->status,
                'repost_of_id' => $original->id,
                'published_at' => now(),
            ]);

            DB::table('post_reposts')->insert([
                'user_id' => $user->id,
                'original_post_id' => $original->id,
                'repost_post_id' => $repost->id,
                'created_at' => now(),
            ]);

            return $repost;
        });
    }

    /** Removes the current user's repost(s) of the given original post. */
    public function unrepost(Post $original, User $user): void
    {
        PostInteractionRules::assertPublicInteractionsAllowed($original);

        DB::transaction(function () use ($original, $user): void {
            $repostIds = DB::table('post_reposts')
                ->where('user_id', $user->id)
                ->where('original_post_id', $original->id)
                ->pluck('repost_post_id')
                ->filter()
                ->all();

            DB::table('post_reposts')
                ->where('user_id', $user->id)
                ->where('original_post_id', $original->id)
                ->delete();

            if ($repostIds !== []) {
                Post::query()->whereIn('id', $repostIds)->delete();
            }
        });
    }

    private function syncLinkedChannelPostLikes(Post $post): void
    {
        ChannelPost::query()
            ->where('feed_post_id', $post->id)
            ->update(['likes_count' => (int) $post->reactions_count]);
    }

    private function notifyLike(Post $post, User $actor): void
    {
        $author = $post->author ?? User::query()->find($post->user_id);
        if (! $author || (int) $author->id === (int) $actor->id) {
            return;
        }

        InAppNotify::sendQuiet(
            $author,
            new InAppNotification(
                'likes',
                UserLabel::display($actor).' лайкнул(а) ваш пост',
                (string) ($post->title ?? ''),
                '/feed',
            ),
        );
    }
}

<?php

namespace Modules\Feed\Services;

use App\Enums\ContentStatus;
use App\Models\Post;
use App\Models\PostReaction;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PostInteractionService
{
    public function react(Post $post, User $user, string $type = 'like'): Post
    {
        if ($post->status !== ContentStatus::Published) {
            throw ValidationException::withMessages([
                'post' => ['Реакции доступны только для опубликованных записей.'],
            ]);
        }

        $created = PostReaction::query()->firstOrCreate(
            ['post_id' => $post->id, 'user_id' => $user->id],
            ['type' => $type],
        );

        if ($created->wasRecentlyCreated) {
            $post->increment('reactions_count');
        } elseif ($created->type !== $type) {
            $created->update(['type' => $type]);
        }

        return $post->fresh();
    }

    public function removeReaction(Post $post, User $user): Post
    {
        $deleted = PostReaction::query()
            ->where('post_id', $post->id)
            ->where('user_id', $user->id)
            ->delete();

        if ($deleted) {
            $post->decrement('reactions_count');
        }

        return $post->fresh();
    }

    public function bookmark(Post $post, User $user): void
    {
        DB::table('post_bookmarks')->insertOrIgnore([
            'user_id' => $user->id,
            'post_id' => $post->id,
            'created_at' => now(),
        ]);
    }

    public function removeBookmark(Post $post, User $user): void
    {
        DB::table('post_bookmarks')
            ->where('user_id', $user->id)
            ->where('post_id', $post->id)
            ->delete();
    }

    public function repost(Post $original, User $user): Post
    {
        if ($original->status !== ContentStatus::Published) {
            throw ValidationException::withMessages([
                'post' => ['Нельзя репостить неопубликованную запись.'],
            ]);
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
}

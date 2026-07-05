<?php

namespace Modules\Feed\Services;

use App\Enums\ContentStatus;
use App\Models\Comment;
use App\Models\CommentReaction;
use App\Models\Post;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class CommentService
{
    public function listForPost(Post $post, int $perPage = 20): LengthAwarePaginator
    {
        return Comment::query()
            ->with([
                'author.profile.avatar',
                'replies' => fn ($q) => $q
                    ->with(['author.profile.avatar'])
                    ->where('status', 'published')
                    ->orderBy('created_at'),
            ])
            ->where('commentable_type', Post::class)
            ->where('commentable_id', $post->id)
            ->whereNull('parent_id')
            ->where('status', 'published')
            ->orderBy('created_at')
            ->paginate($perPage);
    }

    public function createOnPost(Post $post, User $user, string $body, ?string $parentUuid = null): Comment
    {
        if ($post->status !== ContentStatus::Published) {
            throw ValidationException::withMessages([
                'post' => ['Комментарии доступны только для опубликованных записей.'],
            ]);
        }

        $parent = null;
        $rootId = null;
        $depth = 0;

        if ($parentUuid) {
            $parent = Comment::query()->where('uuid', $parentUuid)->first();

            if (! $parent || $parent->commentable_id !== $post->id || $parent->commentable_type !== Post::class) {
                throw ValidationException::withMessages([
                    'parent_id' => ['Родительский комментарий не найден.'],
                ]);
            }

            $depth = $parent->depth + 1;
            $maxDepth = config('feed.max_comment_depth', 5);

            if ($depth >= $maxDepth) {
                throw ValidationException::withMessages([
                    'parent_id' => ['Достигнута максимальная глубина обсуждения.'],
                ]);
            }

            $rootId = $parent->root_id ?? $parent->id;
        }

        $comment = Comment::create([
            'commentable_type' => Post::class,
            'commentable_id' => $post->id,
            'user_id' => $user->id,
            'parent_id' => $parent?->id,
            'root_id' => $rootId,
            'depth' => $depth,
            'body' => $body,
            'status' => 'published',
        ]);

        $post->increment('comments_count');

        return $comment->load(['author.profile.avatar']);
    }

    public function findByUuid(string $uuid): Comment
    {
        $comment = Comment::query()->where('uuid', $uuid)->first();

        if (! $comment) {
            throw new NotFoundHttpException('Комментарий не найден.');
        }

        return $comment;
    }

    public function react(Comment $comment, User $user, string $type = 'like'): Comment
    {
        if ($comment->status !== 'published') {
            throw ValidationException::withMessages([
                'comment' => ['Реакции доступны только для опубликованных комментариев.'],
            ]);
        }

        $reaction = CommentReaction::query()->firstOrCreate(
            ['comment_id' => $comment->id, 'user_id' => $user->id],
            ['type' => $type],
        );

        if ($reaction->wasRecentlyCreated) {
            $comment->increment('reactions_count');
        } elseif ($reaction->type !== $type) {
            $reaction->update(['type' => $type]);
        }

        return $comment->fresh();
    }

    public function removeReaction(Comment $comment, User $user): Comment
    {
        $deleted = CommentReaction::query()
            ->where('comment_id', $comment->id)
            ->where('user_id', $user->id)
            ->delete();

        if ($deleted && $comment->reactions_count > 0) {
            $comment->decrement('reactions_count');
        }

        return $comment->fresh();
    }

    public function thread(string $uuid): Collection
    {
        $root = Comment::query()->where('uuid', $uuid)->first();

        if (! $root) {
            throw new NotFoundHttpException('Комментарий не найден.');
        }

        $rootId = $root->root_id ?? $root->id;

        return Comment::query()
            ->with(['author.profile.avatar'])
            ->where(function ($q) use ($rootId): void {
                $q->where('id', $rootId)
                    ->orWhere('root_id', $rootId);
            })
            ->where('status', 'published')
            ->orderBy('created_at')
            ->get();
    }
}

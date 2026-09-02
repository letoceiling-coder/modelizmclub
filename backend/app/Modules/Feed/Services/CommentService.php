<?php

namespace Modules\Feed\Services;

use App\Models\Comment;
use App\Models\CommentReaction;
use App\Models\Post;
use App\Models\User;
use App\Notifications\InAppNotification;
use App\Services\InAppNotify;
use App\Support\UserLabel;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;
use Modules\Feed\Support\PostInteractionRules;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class CommentService
{
    public function listForPost(Post $post, int $perPage = 20, string $sort = 'interesting'): LengthAwarePaginator
    {
        $sort = in_array($sort, ['interesting', 'old', 'new'], true) ? $sort : 'interesting';
        $perPage = max(1, min($perPage, 100));

        $query = Comment::query()
            ->with([
                'author.profile.avatar',
                'replies' => function ($q) use ($sort): void {
                    $q->with(['author.profile.avatar'])
                        ->where('status', 'published')
                        ->reorder();
                    $this->applyCommentSort($q, $sort);
                },
            ])
            ->where('commentable_type', Post::class)
            ->where('commentable_id', $post->id)
            ->whereNull('parent_id')
            ->where('status', 'published');

        $this->applyCommentSort($query, $sort);

        return $query->paginate($perPage);
    }

    public function createOnPost(Post $post, User $user, string $body, ?string $parentUuid = null): Comment
    {
        PostInteractionRules::assertPublicInteractionsAllowed($post);

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

        $this->notifyComment($post, $comment, $user, $parent);

        return $comment->load(['author.profile.avatar']);
    }

    private function notifyComment(Post $post, Comment $comment, User $author, ?Comment $parent): void
    {
        $preview = mb_substr(trim($comment->body), 0, 140);
        $from = UserLabel::display($author);
        $link = '/feed';
        $notified = [];

        $postAuthor = $post->author ?? User::query()->find($post->user_id);
        if ($postAuthor && (int) $postAuthor->id !== (int) $author->id) {
            InAppNotify::sendQuiet(
                $postAuthor,
                new InAppNotification('comments', $from.' прокомментировал(а) ваш пост', $preview, $link),
            );
            $notified[$postAuthor->id] = true;
        }

        $parentAuthor = $parent?->author ?? ($parent ? User::query()->find($parent->user_id) : null);
        if ($parentAuthor && (int) $parentAuthor->id !== (int) $author->id && ! isset($notified[$parentAuthor->id])) {
            InAppNotify::sendQuiet(
                $parentAuthor,
                new InAppNotification('comments', $from.' ответил(а) на ваш комментарий', $preview, $link),
            );
        }
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
        $this->assertCommentPostAllowsInteractions($comment);

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
        $this->assertCommentPostAllowsInteractions($comment);

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

    private function assertCommentPostAllowsInteractions(Comment $comment): void
    {
        if ($comment->commentable_type !== Post::class) {
            return;
        }

        $post = Post::query()->find($comment->commentable_id);

        if (! $post) {
            throw ValidationException::withMessages([
                'post' => ['Публикация для комментария не найдена.'],
            ]);
        }

        PostInteractionRules::assertPublicInteractionsAllowed($post);
    }

    /** @param  mixed  $query */
    private function applyCommentSort($query, string $sort): void
    {
        match ($sort) {
            'interesting' => $query->orderByDesc('reactions_count')->orderByDesc('created_at'),
            'old' => $query->orderBy('created_at')->orderBy('id'),
            default => $query->orderByDesc('created_at')->orderByDesc('id'),
        };
    }
}

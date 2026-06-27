<?php

namespace Modules\Feed\Services;

use App\Enums\ContentStatus;
use App\Models\ModerationQueue;
use App\Models\Post;
use App\Models\PostCategory;
use App\Models\Tag;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Modules\Feed\Support\PostMediaSync;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class PostService
{
    public function __construct(
        private readonly PostMediaSync $mediaSync,
    ) {}

    public function findByUuid(string $uuid, ?User $viewer = null): Post
    {
        $post = Post::query()
            ->with($this->defaultRelations())
            ->where('uuid', $uuid)
            ->first();

        if (! $post) {
            throw new NotFoundHttpException('Публикация не найдена.');
        }

        if ($viewer && ! $viewer->can('view', $post)) {
            throw new NotFoundHttpException('Публикация не найдена.');
        }

        if (! $viewer && $post->status !== ContentStatus::Published) {
            throw new NotFoundHttpException('Публикация не найдена.');
        }

        $this->attachViewerFlags($post, $viewer);

        return $post;
    }

    /** @param array<string, mixed> $data */
    public function create(User $user, array $data): Post
    {
        $this->assertCategoryExists($data['category_id'] ?? null);
        $this->assertCommunityAccess($user, $data['community_id'] ?? null, $data['subcategory_id'] ?? null);

        return DB::transaction(function () use ($user, $data): Post {
            $post = Post::create([
                'user_id' => $user->id,
                'community_id' => $data['community_id'] ?? null,
                'subcategory_id' => $data['subcategory_id'] ?? null,
                'category_id' => $data['category_id'],
                'title' => $data['title'],
                'body' => $data['body'],
                'status' => ContentStatus::Draft,
            ]);

            $this->mediaSync->sync($post, $user, $data['media_ids'] ?? []);
            $this->syncHashtags($post, $data['hashtags'] ?? []);

            return $post->fresh($this->defaultRelations());
        });
    }

    /** @param array<string, mixed> $data */
    public function update(Post $post, User $user, array $data): Post
    {
        if (! $user->can('update', $post)) {
            throw ValidationException::withMessages([
                'post' => ['Редактирование недоступно.'],
            ]);
        }

        if (isset($data['category_id'])) {
            $this->assertCategoryExists($data['category_id']);
        }

        if (array_key_exists('community_id', $data) || array_key_exists('subcategory_id', $data)) {
            $this->assertCommunityAccess(
                $user,
                $data['community_id'] ?? $post->community_id,
                $data['subcategory_id'] ?? $post->subcategory_id,
            );
        }

        return DB::transaction(function () use ($post, $user, $data): Post {
            $post->fill(array_filter([
                'community_id' => $data['community_id'] ?? null,
                'subcategory_id' => $data['subcategory_id'] ?? null,
                'category_id' => $data['category_id'] ?? null,
                'title' => $data['title'] ?? null,
                'body' => $data['body'] ?? null,
            ], fn ($value) => $value !== null));

            $post->save();

            if (array_key_exists('media_ids', $data)) {
                $this->mediaSync->sync($post, $user, $data['media_ids']);
            }

            if (array_key_exists('hashtags', $data)) {
                $this->syncHashtags($post, $data['hashtags']);
            }

            return $post->fresh($this->defaultRelations());
        });
    }

    public function delete(Post $post, User $user): void
    {
        if (! $user->can('delete', $post)) {
            throw ValidationException::withMessages([
                'post' => ['Удаление недоступно.'],
            ]);
        }

        $post->delete();
    }

    public function publish(Post $post, User $user): Post
    {
        if (! $user->can('publish', $post)) {
            throw ValidationException::withMessages([
                'post' => ['Публикация недоступна.'],
            ]);
        }

        return DB::transaction(function () use ($post): Post {
            $post->update([
                'status' => ContentStatus::PendingModeration,
            ]);

            ModerationQueue::query()->updateOrCreate(
                [
                    'moderatable_type' => Post::class,
                    'moderatable_id' => $post->id,
                ],
                [
                    'queue' => 'posts',
                    'priority' => 0,
                    'status' => 'pending',
                ],
            );

            if (config('feed.auto_publish')) {
                $this->markPublished($post);
            }

            return $post->fresh($this->defaultRelations());
        });
    }

    public function markPublished(Post $post): void
    {
        $post->update([
            'status' => ContentStatus::Published,
            'published_at' => $post->published_at ?? now(),
            'moderated_at' => now(),
        ]);

        ModerationQueue::query()
            ->where('moderatable_type', Post::class)
            ->where('moderatable_id', $post->id)
            ->update(['status' => 'approved']);

        if ($post->community_id) {
            \App\Models\Community::query()->whereKey($post->community_id)->increment('posts_count');
        }
    }

    /** @return list<string> */
    public function defaultRelations(): array
    {
        return [
            'author.profile.avatar',
            'category',
            'community',
            'mediaItems.media',
            'tags',
            'repostOf.author.profile',
        ];
    }

    /**
     * Count a view for a published post. The author's own views are ignored.
     * Updates the in-memory model so the response reflects the new total.
     */
    public function recordView(Post $post, ?User $viewer): void
    {
        if ($post->status !== ContentStatus::Published) {
            return;
        }

        if ($viewer && $viewer->id === $post->user_id) {
            return;
        }

        $post->increment('views_count');
    }

    public function attachViewerFlags(Post $post, ?User $viewer): void
    {
        if (! $viewer) {
            $post->viewer_reacted = false;
            $post->viewer_bookmarked = false;

            return;
        }

        $post->viewer_reacted = $post->reactions()
            ->where('user_id', $viewer->id)
            ->exists();

        $post->viewer_bookmarked = DB::table('post_bookmarks')
            ->where('post_id', $post->id)
            ->where('user_id', $viewer->id)
            ->exists();
    }

    /**
     * Batch-attach viewer flags to a collection of posts using two queries total
     * (avoids the per-post N+1 when rendering the feed).
     *
     * @param  \Illuminate\Support\Collection<int, Post>  $posts
     */
    public function attachViewerFlagsToCollection($posts, ?User $viewer): void
    {
        if ($viewer === null) {
            $posts->each(function (Post $post): void {
                $post->viewer_reacted = false;
                $post->viewer_bookmarked = false;
            });

            return;
        }

        $ids = $posts->pluck('id')->filter()->values()->all();

        if ($ids === []) {
            return;
        }

        $reacted = array_flip(
            DB::table('post_reactions')
                ->where('user_id', $viewer->id)
                ->whereIn('post_id', $ids)
                ->pluck('post_id')
                ->all(),
        );

        $bookmarked = array_flip(
            DB::table('post_bookmarks')
                ->where('user_id', $viewer->id)
                ->whereIn('post_id', $ids)
                ->pluck('post_id')
                ->all(),
        );

        $posts->each(function (Post $post) use ($reacted, $bookmarked): void {
            $post->viewer_reacted = isset($reacted[$post->id]);
            $post->viewer_bookmarked = isset($bookmarked[$post->id]);
        });
    }

    /** @param list<string> $hashtags */
    private function syncHashtags(Post $post, array $hashtags): void
    {
        $tagIds = [];

        foreach ($hashtags as $name) {
            $name = trim((string) $name);
            if ($name === '') {
                continue;
            }

            $slug = Str::slug($name);
            if ($slug === '') {
                continue;
            }

            $tag = Tag::query()->firstOrCreate(
                ['slug' => $slug],
                ['name' => ltrim($name, '#'), 'usage_count' => 0],
            );

            $tagIds[] = $tag->id;
        }

        $existingTagIds = $post->tags()->pluck('tags.id')->all();
        $post->tags()->sync($tagIds);

        $newTagIds = array_diff($tagIds, $existingTagIds);

        if ($newTagIds !== []) {
            Tag::query()
                ->whereIn('id', $newTagIds)
                ->update(['usage_count' => DB::raw('usage_count + 1')]);
        }
    }

    private function assertCategoryExists(?int $categoryId): void
    {
        if ($categoryId === null) {
            throw ValidationException::withMessages([
                'category_id' => ['Категория обязательна.'],
            ]);
        }

        if (! PostCategory::query()->whereKey($categoryId)->where('is_active', true)->exists()) {
            throw ValidationException::withMessages([
                'category_id' => ['Категория не найдена.'],
            ]);
        }
    }

    private function assertCommunityAccess(User $user, ?int $communityId, ?int $subcategoryId): void
    {
        if ($communityId === null) {
            return;
        }

        $community = \App\Models\Community::query()->find($communityId);

        if (! $community) {
            throw ValidationException::withMessages([
                'community_id' => ['Сообщество не найдено.'],
            ]);
        }

        $isMember = $community->members()->where('users.id', $user->id)->exists();

        if (! $isMember && ! $user->isModerator()) {
            throw ValidationException::withMessages([
                'community_id' => ['Нужно состоять в сообществе, чтобы публиковать там.'],
            ]);
        }

        if ($subcategoryId !== null) {
            $valid = $community->subcategories()->whereKey($subcategoryId)->exists();

            if (! $valid) {
                throw ValidationException::withMessages([
                    'subcategory_id' => ['Подкатегория не принадлежит сообществу.'],
                ]);
            }
        }
    }
}

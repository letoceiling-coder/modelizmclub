<?php

namespace Modules\Feed\Services;

use App\Enums\ContentStatus;
use App\Models\Community;
use App\Models\ModerationQueue;
use App\Models\Post;
use App\Models\PostCategory;
use App\Models\SystemSetting;
use App\Models\Tag;
use App\Models\User;
use App\Notifications\InAppNotification;
use App\Services\InAppNotify;
use App\Support\UserLabel;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
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
        if ($post->user_id === $user->id) {
            if (! in_array($post->status, [
                ContentStatus::Draft,
                ContentStatus::Revision,
                ContentStatus::Scheduled,
                ContentStatus::Published,
                ContentStatus::PendingModeration,
                ContentStatus::Rejected,
                ContentStatus::Hidden,
                ContentStatus::Archived,
            ], true)) {
                throw ValidationException::withMessages([
                    'post' => ['Удаление недоступно для этой публикации.'],
                ]);
            }

            $this->forgetRepostRecord($post);
            $post->delete();

            return;
        }

        if (! $user->can('delete', $post)) {
            throw ValidationException::withMessages([
                'post' => ['Удаление недоступно.'],
            ]);
        }

        $this->forgetRepostRecord($post);
        $post->delete();
    }

    /** Keep post_reposts in sync so «уже репостнул» не залипает после удаления карточки. */
    private function forgetRepostRecord(Post $post): void
    {
        if (! $post->repost_of_id) {
            return;
        }

        DB::table('post_reposts')->where('repost_post_id', $post->id)->delete();
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
                'scheduled_at' => null,
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

            if ($this->autoPublishEnabled()) {
                $this->markPublished($post);
            }

            return $post->fresh($this->defaultRelations());
        });
    }

    /**
     * Whether new posts should be auto-published (moderation OFF).
     * Prefers the admin-controlled `feature.feed_auto_publish` SystemSetting
     * (JSON `{ "enabled": bool }`), falling back to `config('feed.auto_publish')`
     * when the setting is absent — so it can be flipped without a redeploy.
     */
    public function autoPublishEnabled(): bool
    {
        $setting = SystemSetting::query()
            ->where('key', 'feature.feed_auto_publish')
            ->value('value');

        if (is_array($setting) && array_key_exists('enabled', $setting)) {
            return (bool) $setting['enabled'];
        }

        return (bool) config('feed.auto_publish');
    }

    public function markPublished(Post $post): void
    {
        $already = $post->status === ContentStatus::Published;

        $post->update([
            'status' => ContentStatus::Published,
            'published_at' => $post->published_at ?? now(),
            'scheduled_at' => null,
            'moderated_at' => now(),
        ]);

        ModerationQueue::query()
            ->where('moderatable_type', Post::class)
            ->where('moderatable_id', $post->id)
            ->update(['status' => 'approved']);

        if ($post->community_id) {
            Community::query()->whereKey($post->community_id)->increment('posts_count');
        }

        if (! $already) {
            $this->notifyFollowers($post);
        }
    }

    private function notifyFollowers(Post $post): void
    {
        $author = $post->author ?? User::query()->with('profile')->find($post->user_id);
        if (! $author) {
            return;
        }

        $title = UserLabel::display($author).' опубликовал(а) пост';
        $body = (string) ($post->title ?? '');

        User::query()
            ->whereIn('id', $author->followers()->select('users.id'))
            ->with('profile')
            ->chunkById(100, function ($followers) use ($title, $body): void {
                foreach ($followers as $follower) {
                    InAppNotify::sendQuiet(
                        $follower,
                        new InAppNotification('subscription_posts', $title, $body, '/feed'),
                    );
                }
            });
    }

    public function schedule(Post $post, User $user, \DateTimeInterface $scheduledAt): Post
    {
        if ($post->user_id !== $user->id) {
            throw ValidationException::withMessages([
                'post' => ['Планирование доступно только автору публикации.'],
            ]);
        }

        if (! in_array($post->status, [
            ContentStatus::Draft,
            ContentStatus::Revision,
            ContentStatus::Scheduled,
        ], true)) {
            throw ValidationException::withMessages([
                'post' => ['Эту публикацию нельзя запланировать.'],
            ]);
        }

        $at = \Illuminate\Support\Carbon::parse($scheduledAt);

        if ($at->isPast()) {
            throw ValidationException::withMessages([
                'scheduled_at' => ['Время публикации должно быть в будущем.'],
            ]);
        }

        if ($at->greaterThan(now()->addYear())) {
            throw ValidationException::withMessages([
                'scheduled_at' => ['Можно запланировать публикацию не более чем на год вперёд.'],
            ]);
        }

        $post->update([
            'status' => ContentStatus::Scheduled,
            'scheduled_at' => $at,
        ]);

        return $post->fresh($this->defaultRelations());
    }

    public function cancelSchedule(Post $post, User $user): Post
    {
        if ($post->user_id !== $user->id) {
            throw ValidationException::withMessages([
                'post' => ['Отмена доступна только автору публикации.'],
            ]);
        }

        if ($post->status !== ContentStatus::Scheduled) {
            throw ValidationException::withMessages([
                'post' => ['Публикация не запланирована.'],
            ]);
        }

        $post->update([
            'status' => ContentStatus::Draft,
            'scheduled_at' => null,
        ]);

        return $post->fresh($this->defaultRelations());
    }

    /** Publish all posts whose scheduled time has arrived. */
    public function publishDueScheduledPosts(): int
    {
        $due = Post::query()
            ->where('status', ContentStatus::Scheduled)
            ->whereNotNull('scheduled_at')
            ->where('scheduled_at', '<=', now())
            ->orderBy('scheduled_at')
            ->limit(100)
            ->get();

        $count = 0;

        foreach ($due as $post) {
            $author = $post->author;
            if (! $author) {
                continue;
            }

            try {
                $this->publish($post, $author);
                $count++;
            } catch (\Throwable) {
                // Skip broken rows — cron will retry on next run if still due.
            }
        }

        return $count;
    }

    /** @return list<string> */
    public function defaultRelations(): array
    {
        return [
            'author.profile.avatar',
            'category',
            'community',
            'channelPost.channel.avatar',
            'mediaItems.media',
            'tags',
            'repostOf.author.profile.avatar',
            'repostOf.category',
            'repostOf.mediaItems.media',
            'repostOf.tags',
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

        // De-duplicate: a given viewer (or anonymous IP) only counts once per
        // 6h window, so reloads/bots can't inflate the counter.
        $who = $viewer ? 'u'.$viewer->id : 'ip'.request()->ip();
        if (! Cache::add('pv:'.$post->id.':'.$who, 1, now()->addHours(6))) {
            return;
        }

        $post->increment('views_count');
    }

    public function attachViewerFlags(Post $post, ?User $viewer): void
    {
        $this->attachViewerFlagsToCollection(collect([$post]), $viewer);
    }

    /**
     * Batch-attach viewer flags to a collection of posts using two queries total
     * (avoids the per-post N+1 when rendering the feed). Nested originals on
     * shares get the same flags so the inner card shows real likes/reposts.
     *
     * @param  Collection<int, Post>  $posts
     */
    public function attachViewerFlagsToCollection($posts, ?User $viewer): void
    {
        $originals = $posts
            ->map(fn (Post $post) => $post->relationLoaded('repostOf') ? $post->repostOf : null)
            ->filter();
        $targets = $posts->concat($originals)->filter()->values();
        $ids = $targets->pluck('id')->filter()->unique()->values()->all();

        if ($ids === []) {
            return;
        }

        // Repost totals are public (shown to guests too).
        $repostTotals = DB::table('post_reposts')
            ->whereIn('original_post_id', $ids)
            ->selectRaw('original_post_id, count(*) as c')
            ->groupBy('original_post_id')
            ->pluck('c', 'original_post_id');

        if ($viewer === null) {
            $targets->each(function (Post $post) use ($repostTotals): void {
                $post->viewer_reacted = false;
                $post->viewer_bookmarked = false;
                $post->viewer_reposted = false;
                $post->reposts_total = (int) ($repostTotals[$post->id] ?? 0);
                if ($post->channelPost?->channel) {
                    $post->channelPost->channel->is_subscribed = false;
                }
            });

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

        $reposted = array_flip(
            DB::table('post_reposts')
                ->where('user_id', $viewer->id)
                ->whereIn('original_post_id', $ids)
                ->pluck('original_post_id')
                ->all(),
        );

        $channelIds = $targets
            ->map(fn (Post $post) => $post->channelPost?->channel?->id)
            ->filter()
            ->unique()
            ->values()
            ->all();
        $subscribedChannels = $channelIds === []
            ? []
            : array_flip(
                DB::table('channel_subscriptions')
                    ->where('user_id', $viewer->id)
                    ->whereIn('channel_id', $channelIds)
                    ->pluck('channel_id')
                    ->all(),
            );

        $targets->each(function (Post $post) use ($reacted, $bookmarked, $reposted, $repostTotals, $subscribedChannels): void {
            $post->viewer_reacted = isset($reacted[$post->id]);
            $post->viewer_bookmarked = isset($bookmarked[$post->id]);
            $post->viewer_reposted = isset($reposted[$post->id]);
            $post->reposts_total = (int) ($repostTotals[$post->id] ?? 0);
            if ($post->channelPost?->channel) {
                $post->channelPost->channel->is_subscribed = isset($subscribedChannels[$post->channelPost->channel->id]);
            }
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

        $community = Community::query()->find($communityId);

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

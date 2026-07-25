<?php

namespace Modules\Channel\Services;

use App\Enums\ContentStatus;
use App\Models\Channel;
use App\Models\ChannelPost;
use App\Models\ModerationQueue;
use App\Models\Post;
use App\Models\PostCategory;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Modules\Channel\Support\ChannelPostMediaSync;
use Modules\Feed\Services\PostService;

class ChannelPostService
{
    public function __construct(
        private readonly ChannelPostMediaSync $channelMediaSync,
        private readonly PostService $postService,
    ) {}

    public function requiresModeration(): bool
    {
        return ! $this->postService->autoPublishEnabled();
    }

    /**
     * @param  list<string>  $mediaIds
     */
    public function create(Channel $channel, User $author, array $data, array $mediaIds): ChannelPost
    {
        return DB::transaction(function () use ($channel, $author, $data, $mediaIds): ChannelPost {
            $needsModeration = $this->requiresModeration();

            $channelPost = ChannelPost::query()->create([
                'channel_id' => $channel->id,
                'author_id' => $author->id,
                'text' => $data['text'],
                'kind' => $data['kind'] ?? 'news',
                'status' => $needsModeration ? 'moderation' : 'published',
                'published_at' => $needsModeration ? null : now(),
                'rejection_reason' => null,
            ]);

            $this->channelMediaSync->sync($channelPost, $author, $mediaIds);

            $feedPost = $this->createFeedDraft($channel, $author, $channelPost, $mediaIds);
            $channelPost->update(['feed_post_id' => $feedPost->id]);

            if ($needsModeration) {
                $this->enqueueModeration($channelPost);
            } else {
                $this->postService->markPublished($feedPost);
            }

            return $channelPost;
        });
    }

    public function publish(ChannelPost $channelPost): ChannelPost
    {
        return DB::transaction(function () use ($channelPost): ChannelPost {
            $channelPost->loadMissing('feedPost');

            $channelPost->update([
                'status' => 'published',
                'published_at' => $channelPost->published_at ?? now(),
                'rejection_reason' => null,
            ]);

            if ($channelPost->feedPost) {
                $this->postService->markPublished($channelPost->feedPost);
            }

            $this->updateQueue($channelPost, 'approved');

            return $channelPost->fresh(['author.profile', 'channel', 'media.media', 'feedPost']);
        });
    }

    public function reject(ChannelPost $channelPost, ?string $reason = null): ChannelPost
    {
        return DB::transaction(function () use ($channelPost, $reason): ChannelPost {
            $channelPost->loadMissing('feedPost');

            $channelPost->update([
                'status' => 'rejected',
                'rejection_reason' => $reason,
            ]);

            if ($channelPost->feedPost) {
                $channelPost->feedPost->update([
                    'status' => ContentStatus::Rejected,
                    'rejection_reason' => $reason,
                ]);
            }

            $this->updateQueue($channelPost, 'rejected');

            return $channelPost->fresh(['author.profile', 'channel', 'media.media', 'feedPost']);
        });
    }

    private function enqueueModeration(ChannelPost $channelPost): void
    {
        ModerationQueue::query()->updateOrCreate(
            [
                'moderatable_type' => ChannelPost::class,
                'moderatable_id' => $channelPost->id,
            ],
            [
                'queue' => 'channel_posts',
                'priority' => 0,
                'status' => 'pending',
            ],
        );
    }

    private function updateQueue(ChannelPost $channelPost, string $status): void
    {
        ModerationQueue::query()
            ->where('moderatable_type', ChannelPost::class)
            ->where('moderatable_id', $channelPost->id)
            ->update(['status' => $status]);
    }

    /**
     * @param  list<string>  $mediaIds
     */
    private function createFeedDraft(Channel $channel, User $author, ChannelPost $channelPost, array $mediaIds): Post
    {
        $category = PostCategory::query()->firstOrCreate(
            ['slug' => 'channels'],
            ['name' => 'Каналы', 'is_active' => true, 'sort_order' => 999],
        );

        $title = Str::limit(trim($channelPost->text), 80, '…');

        return $this->postService->create($author, [
            'title' => $title !== '' ? $title : $channel->name,
            'body' => $channelPost->text,
            'category_id' => $category->id,
            'media_ids' => $mediaIds,
        ]);
    }
}

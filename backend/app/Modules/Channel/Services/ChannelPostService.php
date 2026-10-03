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
use Illuminate\Validation\ValidationException;
use Modules\Catalog\Services\CategoryTaxonomyService;
use Modules\Channel\Support\ChannelPostMediaSync;
use Modules\Feed\Services\PostService;

class ChannelPostService
{
    /** Служебный раздел ленты, под которым публикуются записи каналов. */
    private const РАЗДЕЛ_КАНАЛОВ = 'channels';

    public function __construct(
        private readonly ChannelPostMediaSync $channelMediaSync,
        private readonly PostService $postService,
        private readonly CategoryTaxonomyService $taxonomy,
    ) {}

    /**
     * Запись команды канала — владельца и назначенных им администраторов —
     * проверки не ждёт: писать в канал больше никто и не может
     * (ChannelController, canManage). До 18.09 решал только флаг площадки,
     * и запись владельца уходила в очередь.
     */
    public function requiresModeration(Channel $channel, ?User $author): bool
    {
        if ($channel->canManage($author)) {
            return false;
        }

        return ! $this->postService->autoPublishEnabled();
    }

    /**
     * @param  list<string>  $mediaIds
     */
    public function create(Channel $channel, User $author, array $data, array $mediaIds): ChannelPost
    {
        return DB::transaction(function () use ($channel, $author, $data, $mediaIds): ChannelPost {
            $needsModeration = $this->requiresModeration($channel, $author);

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

    public function delete(Channel $channel, ChannelPost $channelPost, User $user): void
    {
        // Убрать запись может и модерация площадки — в отличие от публикации.
        if (! $channel->canModerate($user)) {
            throw ValidationException::withMessages([
                'post' => ['Удалить пост может только владелец или администратор канала.'],
            ]);
        }

        if ((int) $channelPost->channel_id !== (int) $channel->id) {
            throw ValidationException::withMessages([
                'post' => ['Пост не найден.'],
            ]);
        }

        DB::transaction(function () use ($channelPost): void {
            $channelPost->loadMissing('feedPost');

            ModerationQueue::query()
                ->where('moderatable_type', ChannelPost::class)
                ->where('moderatable_id', $channelPost->id)
                ->delete();

            if ($channelPost->feedPost) {
                $channelPost->feedPost->delete();
            }

            $channelPost->delete();
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
        $category = $this->разделКаналов();

        $title = Str::limit(trim($channelPost->text), 80, '…');

        return $this->postService->create($author, [
            'title' => $title !== '' ? $title : $channel->name,
            'body' => $channelPost->text,
            'category_id' => $category->id,
            'media_ids' => $mediaIds,
        ]);
    }
    /**
     * Служебный раздел «Каналы» — заводится целиком или не заводится.
     *
     * Раньше здесь стоял `firstOrCreate` с именем, флагом активности и
     * порядком — и всё. Узел получался наполовину: `depth` оставался нулём
     * по умолчанию колонки, `path` — NULL, а три флага показа брали своё
     * умолчание `true`.
     *
     * Чем это кончилось, видно на проде 03.10. Узел 223 выправили позже
     * (`path` стал `channels`), но флаги остались, и по ним завелись
     * зеркала: «Каналы» — корневой раздел во всех трёх публичных деревьях,
     * включая каталог объявлений и сообщества. То есть служебный раздел
     * ленты предлагается человеку как категория объявления и как категория
     * сообщества.
     *
     * `path` — не украшение: по нему идёт отбор потомков
     * (`path like 'a/b/%'`), и NULL там означает «потомков нет никогда».
     * Считает его `CategoryTaxonomyService`, он же разводит зеркала по
     * флагам; второй реализации быть не должно, иначе они разойдутся
     * (`deploy/scripts/category-tree-drift.sh` как раз про это).
     *
     * Флаги названы явно: раздел живёт только в ленте.
     */
    private function разделКаналов(): PostCategory
    {
        $category = PostCategory::query()->firstOrCreate(
            ['slug' => self::РАЗДЕЛ_КАНАЛОВ],
            [
                'name' => 'Каналы',
                'is_active' => true,
                'sort_order' => 999,
                'in_feed' => true,
                'in_listings' => false,
                'in_communities' => false,
            ],
        );

        // Только у только что заведённого: у существующего флаги и место в
        // дереве — решение администратора, и переписывать его нельзя.
        if ($category->wasRecentlyCreated) {
            $this->taxonomy->syncFromPostCategory($category);
            $category->refresh();
        }

        return $category;
    }

}

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
        $category = $this->feedDirection();

        $title = Str::limit(trim($channelPost->text), 80, '…');

        return $this->postService->create($author, [
            'title' => $title !== '' ? $title : $channel->name,
            'body' => $channelPost->text,
            'category_id' => $category->id,
            'media_ids' => $mediaIds,
        ]);
    }

    /**
     * Направление «Каналы» — целиком или никак.
     *
     * ЧТО БЫЛО. Здесь стоял `firstOrCreate(['slug' => 'channels'], [...])` без
     * `path` и `depth`. Колонка `path` объявлена nullable и без значения по
     * умолчанию, то есть узел заводился с пустым путём — корневое направление,
     * которое по `parent_id` корневое, а по `path` не существует. Аудит 03.10
     * нашёл такую строку на демо-базе (`#30 channels: path ПУСТО`); на боевой
     * её нет — там узел однажды завели правильно, с обоими отражениями
     * (`listing_categories` 189, `community_categories` 133).
     *
     * ЧЕМ ПЛОХО. По `path` идёт отбор потомков (`path like 'a/b/%'`).
     * `CategoryTaxonomyService::mirrorIdsForPostCategory` пустой путь терпит и
     * переходит на обход по `parent_id`, а `AddDirectionSubcategoriesCommand` и
     * построение дерева в админке — нет. Сверка `categories:normalize --check`
     * на такой строке падает, и до 03.10 её не запускал никто: в воротах CI
     * она не стояла.
     *
     * КАК ТЕПЕРЬ. Создание идёт через `syncFromPostCategory` — ту же дорогу,
     * которой пользуются `categories:single-source` и
     * `categories:add-subcategories`: она ставит `depth` и `path`, заводит
     * отражения в каталоге и сообществах и сбрасывает кеш каталога. Второй
     * реализации этих правил быть не должно, иначе они разойдутся.
     *
     * Дорога срабатывает один раз за всё время — при самой первой записи
     * канала. Сброс кеша каталога в этом запросе осознан: лучше один раз на
     * заведении узла, чем дерево, которое не сходится само с собой.
     */
    private function feedDirection(): PostCategory
    {
        $category = PostCategory::query()->firstOrCreate(
            ['slug' => 'channels'],
            ['name' => 'Каналы', 'is_active' => true, 'sort_order' => 999],
        );

        if ($category->wasRecentlyCreated) {
            $this->taxonomy->syncFromPostCategory($category);
            $category = $category->fresh();
        }

        return $category;
    }
}

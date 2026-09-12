<?php

namespace App\Support\Demo;

use App\Enums\ListingStatus;
use App\Models\PostCategory;
use App\Support\DemoListingCatalog;
use App\Models\User;
use App\Models\City;
use Illuminate\Support\Facades\DB;
use Modules\Chat\Services\ChatService;
use Modules\Feed\Services\PostService;
use Modules\Listing\Services\ListingService;
use Modules\Media\Services\MediaUploadService;

/**
 * Полнота по дереву направлений: чтобы нигде не было пусто.
 *
 * ЭТО ПРОВЕРКА, А НЕ НАПОЛНЕНИЕ. Раздел сперва считает, что уже есть в каждом
 * узле, и добирает только недостающее. Поэтому на выкаченном сервере, где
 * часть узлов уже наполнена объявлениями `listings:demo`, он не удваивает их,
 * а дотягивает пустые.
 *
 * ЧЕГО ДОБИРАЕМ. В каждом узле дерева — две опубликованные записи. В каждой
 * подкатегории — ещё три участника комнаты обсуждения. Комнаты в этой системе
 * существуют только у узлов с родителем (`ChatService::findOrCreateCategoryRoom`
 * требует предка), поэтому у корневых направлений комнат нет и требовать их
 * нечего.
 *
 * ОБЪЯВЛЕНИЯ — НЕ ВЕЗДЕ. Торговых узлов меньше, чем узлов дерева: в выставках,
 * обзоров и техниках продавать нечего, и это решение принято раньше — список
 * торговых узлов лежит в `DemoListingCatalog::ITEMS`. Добор объявлений идёт
 * только по ним. Иначе полнота лезла бы ровно в те шестнадцать узлов, куда
 * лоты сознательно не ставили: `events/*`, `reviews/*`, `techniques/*`,
 * `rybalka/trofei`, `rybalka/vodoemy`, `aviation/planery/il-6`.
 *
 * Поведение переключается: `--fill-listings-everywhere` добирает лоты во всех
 * подкатегориях. По умолчанию выключено — согласовано 12.09.
 *
 * ЦЕНА. Каждая запись и каждое объявление тянут по одной картинке через
 * конвейер медиа. На дереве из семидесяти девяти узлов это сотни изображений;
 * точное число команда печатает в сухом прогоне до создания.
 */
class DemoCoverageSection extends DemoSection
{
    private const POSTS_PER_NODE = 2;

    private const LISTINGS_PER_SUB = 2;

    private const ROOM_MEMBERS = 3;

    /** Добирать ли объявления в неторговых узлах. По умолчанию — нет. */
    private bool $listingsEverywhere = false;

    public function fillListingsEverywhere(bool $value): void
    {
        $this->listingsEverywhere = $value;
    }

    public function __construct(
        private readonly PostService $posts,
        private readonly ListingService $listings,
        private readonly ChatService $chat,
        private readonly MediaUploadService $uploads,
    ) {}

    public function key(): string
    {
        return 'coverage';
    }

    public function title(): string
    {
        return 'Полнота дерева направлений';
    }

    public function columns(): array
    {
        return ['узел', 'записей не хватает', 'объявлений не хватает', 'в комнате не хватает'];
    }

    public function plan(): array
    {
        $gaps = $this->gaps();
        $rows = [];
        $create = 0;

        foreach ($gaps as $gap) {
            if ($gap['posts'] === 0 && $gap['listings'] === 0 && $gap['members'] === 0) {
                continue;
            }
            $rows[] = [$gap['path'], $gap['posts'], $gap['listings'], $gap['members']];
            $create += $gap['posts'] + $gap['listings'];
        }

        if ($rows === []) {
            $rows[] = ['во всех узлах всё есть', 0, 0, 0];
        }

        return ['rows' => $rows, 'create' => $create, 'exists' => count($gaps) - count($rows)];
    }

    public function create(callable $tick): int
    {
        $people = array_values($this->people());
        if ($people === []) {
            return 0;
        }

        $cityIds = City::query()->orderBy('id')->limit(25)->pluck('id')->all();
        $made = 0;

        foreach ($this->gaps() as $index => $gap) {
            $node = $gap['node'];

            for ($i = 0; $i < $gap['posts']; $i++) {
                $author = $people[($index + $i) % count($people)];
                $title = self::MARKER.' '.$node->name.' — обзор '.($i + 1);
                $post = $this->posts->create($author, [
                    'category_id' => (int) $node->id,
                    'title' => $title,
                    'body' => DemoTexts::medium($title),
                    'media_ids' => [$this->image($author, $this->uploads, $title, 'post')->uuid],
                ]);
                $this->posts->markPublished($post);
                $post->forceFill(['published_at' => now()->subDays(($index + $i) % 25)])->save();
                $made++;
                $tick($node->name.' — запись');
            }

            for ($i = 0; $i < $gap['listings']; $i++) {
                $seller = $people[($index * 3 + $i) % count($people)];
                $title = self::MARKER.' '.$node->name.' — набор '.($i + 1);
                $listing = $this->listings->create($seller, [
                    'taxonomy_id' => (int) $node->id,
                    'title' => $title,
                    'description' => self::MARKER."\n\nДемонстрационный лот. Ничего не продаётся.",
                    'price_cents' => (1500 + ($index % 20) * 250) * 100,
                    'condition' => $i % 2 === 0 ? 'new' : 'used',
                    'city_id' => $cityIds === [] ? null : $cityIds[($index + $i) % count($cityIds)],
                    'delivery_methods' => ['Почта России', 'Самовывоз'],
                    'pickup_address' => 'Центр города, по договорённости',
                    'media_ids' => [$this->image($seller, $this->uploads, $title, 'listing')->uuid],
                    'publish' => false,
                ]);
                $this->listings->markPublished($listing);
                $made++;
                $tick($node->name.' — объявление');
            }

            for ($i = 0; $i < $gap['members']; $i++) {
                $member = $people[($index * 5 + $i + 1) % count($people)];
                $this->chat->findOrCreateCategoryRoom((int) $node->parent_id, (int) $node->id, $member);
            }
        }

        return $made;
    }

    /**
     * Чего не хватает в каждом узле. Только чтение.
     *
     * @return list<array{node: PostCategory, path: string, posts: int, listings: int, members: int}>
     */
    private function gaps(): array
    {
        $nodes = PostCategory::query()->where('is_active', true)->orderBy('path')->get();
        if ($nodes->isEmpty()) {
            return [];
        }

        $postCounts = DB::table('posts')
            ->whereNull('deleted_at')
            ->where('status', 'published')
            ->whereNotNull('category_id')
            ->groupBy('category_id')
            ->selectRaw('category_id, count(*) as n')
            ->pluck('n', 'category_id')
            ->all();

        $mirrorByPath = DB::table('listing_categories')->pluck('id', 'path')->all();
        $listingCounts = DB::table('listings')
            ->whereNull('deleted_at')
            ->where('status', ListingStatus::Published->value)
            ->groupBy('subcategory_id')
            ->selectRaw('subcategory_id, count(*) as n')
            ->pluck('n', 'subcategory_id')
            ->all();

        $roomMembers = DB::table('conversations as c')
            ->join('conversation_participants as p', 'p.conversation_id', '=', 'c.id')
            ->whereNotNull('c.post_category_id')
            ->groupBy('c.post_category_id')
            ->selectRaw('c.post_category_id as cat, count(*) as n')
            ->pluck('n', 'cat')
            ->all();

        $out = [];
        foreach ($nodes as $node) {
            $hasParent = $node->parent_id !== null;
            $mirrorId = $mirrorByPath[$node->path] ?? null;

            $trades = $this->listingsEverywhere || isset(DemoListingCatalog::ITEMS[$node->slug]);

            $out[] = [
                'node' => $node,
                'path' => (string) $node->path,
                'posts' => max(0, self::POSTS_PER_NODE - (int) ($postCounts[$node->id] ?? 0)),
                'listings' => $hasParent && $trades
                    ? max(0, self::LISTINGS_PER_SUB - (int) ($mirrorId ? ($listingCounts[$mirrorId] ?? 0) : 0))
                    : 0,
                'members' => $hasParent
                    ? max(0, self::ROOM_MEMBERS - (int) ($roomMembers[$node->id] ?? 0))
                    : 0,
            ];
        }

        return $out;
    }
}

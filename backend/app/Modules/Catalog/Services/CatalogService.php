<?php

namespace Modules\Catalog\Services;

use App\Enums\ConversationType;
use App\Enums\ListingStatus;
use App\Models\City;
use App\Models\CommunityCategory;
use App\Models\ListingCategory;
use App\Models\PostCategory;
use App\Models\Tag;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Modules\Catalog\Support\CategoryTreeBuilder;

class CatalogService
{
    /** Reference data changes only via the admin panel, so cache it aggressively. */
    private const TTL = 86400;

    private const KEY_TREE_POST = 'catalog:tree:post';

    private const KEY_TREE_COMMUNITY = 'catalog:tree:community';

    private const KEY_TREE_LISTING = 'catalog:tree:listing';

    private const KEY_CITIES = 'catalog:cities:all';

    private const KEY_TREE_POST_USAGE = 'catalog:tree:post:usage';

    private const KEY_TREE_POST_MEMBERS = 'catalog:tree:post:members';

    public function __construct(
        private readonly CategoryTreeBuilder $treeBuilder,
    ) {}

    /** @return list<array<string, mixed>> */
    public function postCategoryTree(): array
    {
        $tree = Cache::remember(self::KEY_TREE_POST, self::TTL, fn () => $this->categoryTree(PostCategory::query()));
        $counts = Cache::remember(self::KEY_TREE_POST_USAGE, 300, function () {
            $flat = PostCategory::query()->where('is_active', true)->get();

            return app(CategoryTaxonomyService::class)->usageCounts($flat);
        });

        $members = Cache::remember(self::KEY_TREE_POST_MEMBERS, 300, fn () => $this->roomMembersByCategory());

        return $this->attachMemberCounts($this->attachUsageCounts($tree, $counts), $members);
    }

    /**
     * Кто состоит в чатах направления — по узлам дерева.
     *
     * Комната есть у подкатегории и не бывает у направления, поэтому у самого
     * направления участников нет: его люди — это люди его комнат. Считаются
     * они объединением, а не суммой: человек, сидящий в двух комнатах одного
     * направления, — один человек, а сумма посчитала бы его дважды.
     *
     * Вышедшие из комнаты (`left_at`) не в счёт — участник тот, кто состоит
     * сейчас.
     *
     * @return array<int, list<int>> id узла → список user_id
     */
    private function roomMembersByCategory(): array
    {
        $rows = DB::table('conversation_participants as p')
            ->join('conversations as c', 'c.id', '=', 'p.conversation_id')
            ->where('c.type', ConversationType::Room->value)
            ->whereNotNull('c.post_category_id')
            ->whereNull('p.left_at')
            ->select('c.post_category_id as category_id', 'p.user_id')
            ->distinct()
            ->get();

        $byCategory = [];
        foreach ($rows as $row) {
            $byCategory[(int) $row->category_id][] = (int) $row->user_id;
        }

        return $byCategory;
    }

    /**
     * @param  list<array<string, mixed>>  $tree
     * @param  array<int, list<int>>  $members
     * @return list<array<string, mixed>>
     */
    private function attachMemberCounts(array $tree, array $members): array
    {
        [$tree, ] = $this->foldMemberCounts($tree, $members);

        return $tree;
    }

    /**
     * Возвращает поддерево с проставленным `members_count` и множество
     * пользователей этого поддерева — чтобы родитель сложил детей
     * объединением, а не сложением.
     *
     * @param  list<array<string, mixed>>  $nodes
     * @param  array<int, list<int>>  $members
     * @return array{0: list<array<string, mixed>>, 1: array<int, true>}
     */
    private function foldMemberCounts(array $nodes, array $members): array
    {
        $out = [];
        $union = [];

        foreach ($nodes as $node) {
            [$children, $childUsers] = $this->foldMemberCounts($node['children'] ?? [], $members);

            $own = [];
            foreach ($members[$node['id'] ?? 0] ?? [] as $userId) {
                $own[$userId] = true;
            }

            $all = $own + $childUsers;
            $node['children'] = $children;
            $node['members_count'] = count($all);
            $out[] = $node;
            $union += $all;
        }

        return [$out, $union];
    }

    /** @return list<array<string, mixed>> */
    public function communityCategoryTree(): array
    {
        return Cache::remember(self::KEY_TREE_COMMUNITY, self::TTL, fn () => $this->categoryTree(CommunityCategory::query()));
    }

    /** @return list<array<string, mixed>> */
    public function listingCategoryTree(): array
    {
        return Cache::remember(self::KEY_TREE_LISTING, self::TTL, fn () => $this->categoryTree(ListingCategory::query(), includeListingPrice: true));
    }

    /**
     * Forget every cached reference-data entry. Called from the admin category
     * controllers so edits are reflected immediately instead of after the TTL.
     */
    public static function flushCache(): void
    {
        foreach ([self::KEY_TREE_POST, self::KEY_TREE_COMMUNITY, self::KEY_TREE_LISTING, self::KEY_CITIES, self::KEY_TREE_POST_USAGE, self::KEY_TREE_POST_MEMBERS] as $key) {
            Cache::forget($key);
        }

        // Деревья категорий входят и в bootstrap: без этого правка в админке
        // доехала бы до лендинга и ленты только по истечении его TTL.
        \Modules\PublicContent\Services\PublicBootstrapService::forget();
    }

    /** @return Collection<int, City> */
    public function cities(?string $query = null): Collection
    {
        // Only the unfiltered list is cacheable; search queries stay dynamic.
        if ($query === null || $query === '') {
            return Cache::remember(self::KEY_CITIES, self::TTL, fn () => $this->fetchCities(null));
        }

        return $this->fetchCities($query);
    }

    /** @return Collection<int, City> */
    private function fetchCities(?string $query): Collection
    {
        $builder = City::query()
            ->where('is_active', true)
            ->when($query, fn ($q) => $q->where(function ($q) use ($query): void {
                $q->where('name', 'ilike', "%{$query}%");
                // Region substring match pollutes short queries (e.g. «К» hits
                // «Самарская»). Only widen to region for 2+ characters.
                if (mb_strlen($query) >= 2) {
                    $q->orWhere('region', 'ilike', "%{$query}%");
                }
            }))
            ->orderBy('sort_order')
            ->orderBy('name');

        // Empty query → popular cities; search → capped result set for autocomplete UX.
        $limit = ($query === null || $query === '') ? 30 : 50;

        return $builder->limit($limit)->get();
    }

    /** @return Collection<int, Tag> */
    public function searchTags(?string $query, int $limit = 20): Collection
    {
        return Tag::query()
            ->when($query, fn ($q) => $q->where(function ($q) use ($query): void {
                $q->where('name', 'ilike', "%{$query}%")
                    ->orWhere('slug', 'ilike', "%{$query}%");
            }))
            ->orderByDesc('usage_count')
            ->orderBy('name')
            ->limit($limit)
            ->get();
    }

    /** @return list<array<string, mixed>> */
    private function categoryTree($query, bool $includeListingPrice = false): array
    {
        if ($includeListingPrice) {
            $query = $query->withCount([
                'listings as listings_count' => fn ($q) => $q->where('status', ListingStatus::Published),
            ]);
        }

        /** @var Collection<int, Model> $flat */
        $flat = $query
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return $this->treeBuilder->build(
            $flat,
            fn (Model $item) => $this->mapCategoryNode($item, $includeListingPrice),
        );
    }

    private function mapCategoryNode(Model $item, bool $includeListingPrice): array
    {
        $node = [
            'id' => $item->getKey(),
            'name' => $item->name,
            'slug' => $item->slug,
            'icon' => $item->icon,
            'icon_image_url' => $item->icon_image_url ?? null,
            'depth' => $item->depth,
            'sort_order' => $item->sort_order,
        ];

        if ($includeListingPrice) {
            if (isset($item->listing_price_cents)) {
                $node['listing_price_cents'] = $item->listing_price_cents;
            }
            $node['listings_count'] = (int) ($item->listings_count ?? 0);
        }

        return $node;
    }

    /**
     * @param  list<array<string, mixed>>  $tree
     * @param  array<int, int>  $counts
     * @return list<array<string, mixed>>
     */
    private function attachUsageCounts(array $tree, array $counts): array
    {
        return array_map(function (array $node) use ($counts): array {
            $children = $this->attachUsageCounts($node['children'] ?? [], $counts);
            $own = (int) ($counts[$node['id'] ?? 0] ?? 0);
            $childSum = 0;
            foreach ($children as $child) {
                $childSum += (int) ($child['usage_count'] ?? 0);
            }
            $node['children'] = $children;
            $node['usage_count'] = $own + $childSum;

            return $node;
        }, $tree);
    }
}

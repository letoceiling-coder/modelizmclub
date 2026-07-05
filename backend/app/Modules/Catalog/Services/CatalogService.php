<?php

namespace Modules\Catalog\Services;

use App\Enums\ListingStatus;
use App\Models\City;
use App\Models\CommunityCategory;
use App\Models\ListingCategory;
use App\Models\PostCategory;
use App\Models\Tag;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Modules\Catalog\Support\CategoryTreeBuilder;

class CatalogService
{
    /** Reference data changes only via the admin panel, so cache it aggressively. */
    private const TTL = 86400;

    private const KEY_TREE_POST = 'catalog:tree:post';

    private const KEY_TREE_COMMUNITY = 'catalog:tree:community';

    private const KEY_TREE_LISTING = 'catalog:tree:listing';

    private const KEY_CITIES = 'catalog:cities:all';

    public function __construct(
        private readonly CategoryTreeBuilder $treeBuilder,
    ) {}

    /** @return list<array<string, mixed>> */
    public function postCategoryTree(): array
    {
        return Cache::remember(self::KEY_TREE_POST, self::TTL, fn () => $this->categoryTree(PostCategory::query()));
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
        foreach ([self::KEY_TREE_POST, self::KEY_TREE_COMMUNITY, self::KEY_TREE_LISTING, self::KEY_CITIES] as $key) {
            Cache::forget($key);
        }
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
        return City::query()
            ->where('is_active', true)
            ->when($query, fn ($q) => $q->where(function ($q) use ($query): void {
                $q->where('name', 'ilike', "%{$query}%")
                    ->orWhere('region', 'ilike', "%{$query}%");
            }))
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();
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
}

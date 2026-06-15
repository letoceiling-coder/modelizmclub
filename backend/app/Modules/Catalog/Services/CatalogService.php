<?php

namespace Modules\Catalog\Services;

use App\Models\City;
use App\Models\CommunityCategory;
use App\Models\ListingCategory;
use App\Models\PostCategory;
use App\Models\Tag;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;
use Modules\Catalog\Support\CategoryTreeBuilder;

class CatalogService
{
    public function __construct(
        private readonly CategoryTreeBuilder $treeBuilder,
    ) {}

    /** @return list<array<string, mixed>> */
    public function postCategoryTree(): array
    {
        return $this->categoryTree(PostCategory::query());
    }

    /** @return list<array<string, mixed>> */
    public function communityCategoryTree(): array
    {
        return $this->categoryTree(CommunityCategory::query());
    }

    /** @return list<array<string, mixed>> */
    public function listingCategoryTree(): array
    {
        return $this->categoryTree(ListingCategory::query(), includeListingPrice: true);
    }

    /** @return Collection<int, City> */
    public function cities(?string $query = null): Collection
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

        if ($includeListingPrice && isset($item->listing_price_cents)) {
            $node['listing_price_cents'] = $item->listing_price_cents;
        }

        return $node;
    }
}

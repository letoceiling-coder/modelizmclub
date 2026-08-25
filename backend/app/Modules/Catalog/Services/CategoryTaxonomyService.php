<?php

namespace Modules\Catalog\Services;

use App\Enums\CommunityStatus;
use App\Enums\ContentStatus;
use App\Enums\ListingStatus;
use App\Models\Channel;
use App\Models\Community;
use App\Models\CommunityCategory;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\Post;
use App\Models\PostCategory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class CategoryTaxonomyService
{
    public const MAX_DEPTH = 2;

    public function applyHierarchy(PostCategory $category): PostCategory
    {
        $parent = $category->parent_id
            ? PostCategory::query()->find($category->parent_id)
            : null;

        if ($category->parent_id && ! $parent) {
            throw ValidationException::withMessages([
                'parent_id' => ['Родительская категория не найдена.'],
            ]);
        }

        if ($parent && $this->isAncestorOf($parent, (int) $category->id)) {
            throw ValidationException::withMessages([
                'parent_id' => ['Нельзя сделать родителем потомка этой категории.'],
            ]);
        }

        $depth = $parent ? ((int) $parent->depth + 1) : 0;
        if ($depth > self::MAX_DEPTH) {
            throw ValidationException::withMessages([
                'parent_id' => ['Максимум три уровня: направление → подкатегория → уточнение.'],
            ]);
        }

        $path = $parent
            ? trim((string) $parent->path.'/'.$category->slug, '/')
            : (string) $category->slug;

        $category->forceFill([
            'depth' => $depth,
            'path' => $path,
        ])->save();

        return $category->fresh();
    }

    public function syncFromPostCategory(PostCategory $category, ?string $previousPath = null): void
    {
        $previousPath ??= (string) $category->path;
        $category = $this->applyHierarchy($category);
        $this->mirror($category, ListingCategory::class, $previousPath);
        $this->mirror($category, CommunityCategory::class, $previousPath);

        foreach ($category->children()->orderBy('sort_order')->get() as $child) {
            $this->syncFromPostCategory($child, (string) $child->path);
        }

        CatalogService::flushCache();
    }

    public function descendantPostIds(int $postCategoryId): array
    {
        $root = PostCategory::query()->find($postCategoryId);
        if (! $root) {
            return [];
        }

        $path = trim((string) $root->path);
        if ($path === '') {
            $ids = [(int) $root->id];
            $this->collectDescendantIds($root, $ids);

            return array_values(array_unique($ids));
        }

        return PostCategory::query()
            ->where(function ($q) use ($root, $path): void {
                $q->where('id', $root->id)
                    ->orWhere('path', $path)
                    ->orWhere('path', 'like', $path.'/%');
            })
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();
    }

    public function listingIdsForPostCategory(int $postCategoryId): array
    {
        return $this->mirrorIdsForPostCategory($postCategoryId, ListingCategory::class);
    }

    public function communityIdsForPostCategory(int $postCategoryId): array
    {
        return $this->mirrorIdsForPostCategory($postCategoryId, CommunityCategory::class);
    }

    /** @return list<string> */
    public function namesForPostCategory(int $postCategoryId): array
    {
        $ids = $this->descendantPostIds($postCategoryId);
        if ($ids === []) {
            return [];
        }

        return PostCategory::query()
            ->whereIn('id', $ids)
            ->pluck('name')
            ->map(fn ($name) => (string) $name)
            ->all();
    }

    /**
     * @param  Collection<int, Model>  $flat
     * @return array<int, int>
     */
    public function usageCounts(Collection $flat): array
    {
        $postCounts = Post::query()
            ->where('status', ContentStatus::Published)
            ->selectRaw('category_id, count(*) as c')
            ->groupBy('category_id')
            ->pluck('c', 'category_id');

        $listingCounts = Listing::query()
            ->where('status', ListingStatus::Published)
            ->selectRaw('category_id, count(*) as c')
            ->groupBy('category_id')
            ->pluck('c', 'category_id');
        $listingSubCounts = Listing::query()
            ->where('status', ListingStatus::Published)
            ->whereNotNull('subcategory_id')
            ->selectRaw('subcategory_id, count(*) as c')
            ->groupBy('subcategory_id')
            ->pluck('c', 'subcategory_id');

        $communityCounts = Community::query()
            ->where('status', CommunityStatus::Active)
            ->selectRaw('category_id, count(*) as c')
            ->groupBy('category_id')
            ->pluck('c', 'category_id');

        $channelCounts = Channel::query()
            ->where('is_active', true)
            ->selectRaw('category, count(*) as c')
            ->whereNotNull('category')
            ->groupBy('category')
            ->pluck('c', 'category');

        $listingByPath = ListingCategory::query()->get(['id', 'path'])->keyBy('id');
        $communityByPath = CommunityCategory::query()->get(['id', 'path'])->keyBy('id');

        $counts = [];
        foreach ($flat as $item) {
            $id = (int) $item->getKey();
            $path = (string) $item->getAttribute('path');
            $name = (string) $item->getAttribute('name');
            $listingId = $listingByPath->firstWhere('path', $path)?->id;
            $communityId = $communityByPath->firstWhere('path', $path)?->id;

            $counts[$id] = (int) ($postCounts[$id] ?? 0)
                + (int) ($listingId ? ($listingCounts[$listingId] ?? 0) + ($listingSubCounts[$listingId] ?? 0) : 0)
                + (int) ($communityId ? ($communityCounts[$communityId] ?? 0) : 0)
                + (int) ($channelCounts[$name] ?? 0);
        }

        return $counts;
    }

    /**
     * @param  class-string<Model>  $class
     */
    private function mirror(PostCategory $source, string $class, ?string $previousPath = null): void
    {
        $parentId = null;
        if ($source->parent_id) {
            $parentPost = PostCategory::query()->find($source->parent_id);
            if ($parentPost) {
                $parentMirror = $class::query()->where('path', $parentPost->path)->first()
                    ?? $class::query()->where('slug', $parentPost->slug)->first();
                $parentId = $parentMirror?->id;
            }
        }

        $existing = $class::query()->where('path', $source->path)->first()
            ?? ($previousPath ? $class::query()->where('path', $previousPath)->first() : null)
            ?? $class::query()
                ->where('slug', $source->slug)
                ->where('parent_id', $parentId)
                ->first()
            ?? $class::query()->where('slug', $source->slug)->first();

        $payload = [
            'parent_id' => $parentId,
            'name' => $source->name,
            'slug' => $source->slug,
            'icon' => $source->icon,
            'sort_order' => $source->sort_order,
            'is_active' => $source->is_active,
            'depth' => $source->depth,
            'path' => $source->path,
        ];

        if ($existing) {
            $existing->fill($payload)->save();

            return;
        }

        $class::query()->create($payload);
    }

    /**
     * @param  class-string<Model>  $class
     * @return list<int>
     */
    private function mirrorIdsForPostCategory(int $postCategoryId, string $class): array
    {
        $ids = [];
        foreach ($this->descendantPostIds($postCategoryId) as $id) {
            $post = PostCategory::query()->find($id);
            if (! $post) {
                continue;
            }
            $mirror = $class::query()->where('path', $post->path)->first()
                ?? $class::query()->where('slug', $post->slug)->first();
            if ($mirror) {
                $ids[] = (int) $mirror->id;
            }
        }

        return array_values(array_unique($ids));
    }

    private function collectDescendantIds(PostCategory $node, array &$ids): void
    {
        foreach ($node->children as $child) {
            $ids[] = (int) $child->id;
            $this->collectDescendantIds($child, $ids);
        }
    }

    private function isAncestorOf(PostCategory $candidateParent, int $categoryId): bool
    {
        $cursor = $candidateParent;
        $guard = 0;
        while ($cursor && $guard++ < 16) {
            if ((int) $cursor->id === $categoryId) {
                return true;
            }
            if (! $cursor->parent_id) {
                return false;
            }
            $cursor = PostCategory::query()->find($cursor->parent_id);
        }

        return false;
    }
}

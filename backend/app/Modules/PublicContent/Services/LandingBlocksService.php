<?php

namespace Modules\PublicContent\Services;

use App\Enums\ContentStatus;
use App\Enums\ListingStatus;
use App\Models\LandingCard;
use App\Models\LandingSection;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\Post;
use App\Models\PostCategory;
use App\Support\LucideIconName;
use Illuminate\Support\Collection;

class LandingBlocksService
{
    /** @return array<string, mixed> */
    public function publicPayload(): array
    {
        $sections = LandingSection::query()
            ->where('is_enabled', true)
            ->orderBy('id')
            ->get();

        $cardsBySection = LandingCard::query()
            ->where('is_active', true)
            ->whereIn('section_slug', $sections->pluck('slug'))
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get()
            ->groupBy('section_slug');

        $categoryMeta = $this->categoryMeta(
            $cardsBySection->flatten(1)->pluck('post_category_id')->filter()->unique()->all()
        );
        $counts = $this->countsByPostCategory($categoryMeta);

        return [
            'sections' => $sections->map(fn (LandingSection $s) => [
                'slug' => $s->slug,
                'eyebrow' => $s->eyebrow,
                'title' => $s->title,
                'subtitle' => $s->subtitle,
                'media_url' => $s->media_url,
                'cards' => ($cardsBySection->get($s->slug) ?? collect())
                    ->map(fn (LandingCard $c) => $this->mapPublicCard($c, $categoryMeta, $counts))
                    ->values()
                    ->all(),
            ])->values()->all(),
        ];
    }

    /** @return array<string, mixed> */
    public function adminPayload(): array
    {
        $sections = LandingSection::query()->orderBy('id')->get();
        $cards = LandingCard::query()->orderBy('section_slug')->orderBy('sort_order')->orderBy('id')->get();

        return [
            'sections' => $sections->map(fn (LandingSection $s) => [
                'id' => $s->id,
                'slug' => $s->slug,
                'eyebrow' => $s->eyebrow,
                'title' => $s->title,
                'subtitle' => $s->subtitle,
                'media_url' => $s->media_url,
                'is_enabled' => $s->is_enabled,
            ])->values()->all(),
            'cards' => $cards->map(fn (LandingCard $c) => $this->mapAdminCard($c))->values()->all(),
        ];
    }

    /** @param list<int|string> $categoryIds */
    private function categoryMeta(array $categoryIds): Collection
    {
        if ($categoryIds === []) {
            return collect();
        }

        return PostCategory::query()
            ->whereIn('id', $categoryIds)
            ->get(['id', 'slug', 'name', 'icon'])
            ->keyBy('id');
    }

    /** @param Collection<int, PostCategory> $categoryMeta */
    private function mapPublicCard(LandingCard $card, Collection $categoryMeta, array $counts): array
    {
        $category = $card->post_category_id ? $categoryMeta->get($card->post_category_id) : null;
        $link = $card->link_url;
        if ($link === null && $category?->slug) {
            $link = '/categories/'.$category->slug;
        }

        return [
            'id' => $card->id,
            'title' => $card->title,
            'description' => $card->description,
            'icon' => LucideIconName::normalize($card->icon ?: $category?->icon),
            'icon_url' => $card->icon_url,
            'link_url' => $link,
            'post_category_id' => $card->post_category_id,
            'listings_count' => $card->post_category_id ? (int) ($counts[$card->post_category_id] ?? 0) : 0,
        ];
    }

    /**
     * @param  Collection<int, PostCategory>  $categoryMeta
     * @return array<int, int>
     */
    private function countsByPostCategory(Collection $categoryMeta): array
    {
        if ($categoryMeta->isEmpty()) {
            return [];
        }

        $postCounts = Post::query()
            ->where('status', ContentStatus::Published)
            ->whereIn('category_id', $categoryMeta->keys())
            ->selectRaw('category_id, COUNT(*) as c')
            ->groupBy('category_id')
            ->pluck('c', 'category_id');

        $listingCategories = ListingCategory::query()
            ->whereIn('slug', $categoryMeta->pluck('slug')->filter()->all())
            ->get(['id', 'slug']);

        $listingCountsByCatId = collect();
        if ($listingCategories->isNotEmpty()) {
            $listingCountsByCatId = Listing::query()
                ->where('status', ListingStatus::Published)
                ->whereIn('category_id', $listingCategories->pluck('id'))
                ->selectRaw('category_id, COUNT(*) as c')
                ->groupBy('category_id')
                ->pluck('c', 'category_id');
        }

        $listingIdBySlug = $listingCategories->pluck('id', 'slug');
        $out = [];
        foreach ($categoryMeta as $id => $category) {
            $listingId = $listingIdBySlug->get($category->slug);
            if ($listingId !== null) {
                $out[$id] = (int) $listingCountsByCatId->get($listingId, 0);
            } else {
                $out[$id] = (int) $postCounts->get($id, 0);
            }
        }

        return $out;
    }

    private function mapAdminCard(LandingCard $card): array
    {
        return [
            'id' => $card->id,
            'section_slug' => $card->section_slug,
            'title' => $card->title,
            'description' => $card->description,
            'icon' => $card->icon,
            'icon_url' => $card->icon_url,
            'link_url' => $card->link_url,
            'post_category_id' => $card->post_category_id,
            'sort_order' => $card->sort_order,
            'is_active' => $card->is_active,
        ];
    }
}

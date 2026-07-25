<?php

namespace Modules\PublicContent\Services;

use App\Models\LandingCard;
use App\Models\LandingSection;
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

        return [
            'sections' => $sections->map(fn (LandingSection $s) => [
                'slug' => $s->slug,
                'eyebrow' => $s->eyebrow,
                'title' => $s->title,
                'subtitle' => $s->subtitle,
                'cards' => ($cardsBySection->get($s->slug) ?? collect())
                    ->map(fn (LandingCard $c) => $this->mapPublicCard($c, $categoryMeta))
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
    private function mapPublicCard(LandingCard $card, Collection $categoryMeta): array
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
            'listings_count' => 0,
        ];
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

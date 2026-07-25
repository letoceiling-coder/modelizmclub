<?php

namespace Database\Seeders;

use App\Models\LandingCard;
use App\Models\LandingSection;
use App\Models\PostCategory;
use Illuminate\Database\Seeder;

class LandingPageSeeder extends Seeder
{
    public function run(): void
    {
        LandingSection::query()->updateOrCreate(
            ['slug' => 'ecosystem'],
            [
                'eyebrow' => 'Экосистема для моделистов',
                'title' => 'Что есть в МоДелизМ',
                'subtitle' => 'Шесть инструментов, которые закрывают повседневные задачи моделиста — от покупки детали до участия в гонках.',
                'is_enabled' => true,
            ],
        );

        LandingSection::query()->updateOrCreate(
            ['slug' => 'directions'],
            [
                'eyebrow' => 'Направления',
                'title' => 'Всё, что движется и летает',
                'subtitle' => null,
                'is_enabled' => true,
            ],
        );

        $ecosystem = [
            ['title' => 'Объявления', 'description' => 'Покупка и продажа моделей, запчастей и техники как на Авито.', 'icon' => 'Megaphone', 'link_url' => '/ads', 'sort_order' => 0],
            ['title' => 'Лента публикаций', 'description' => 'Проекты, сборки, фото и видео других моделистов.', 'icon' => 'Newspaper', 'link_url' => '/feed', 'sort_order' => 1],
            ['title' => 'Сообщества', 'description' => 'Клубы по интересам: RC, авиа, суда, электроника.', 'icon' => 'Users2', 'link_url' => '/communities', 'sort_order' => 2],
            ['title' => 'Каналы', 'description' => 'Официальные каналы брендов, магазинов и экспертов.', 'icon' => 'Radio', 'link_url' => '/channels', 'sort_order' => 3],
            ['title' => 'Мессенджер', 'description' => 'Личные и групповые чаты внутри платформы.', 'icon' => 'MessageSquare', 'link_url' => '/messenger', 'sort_order' => 4],
            ['title' => 'Обзоры', 'description' => 'Видеообзоры моделей, сборок и техники от участников сообщества.', 'icon' => 'Clapperboard', 'link_url' => '/reviews', 'sort_order' => 5],
        ];

        foreach ($ecosystem as $row) {
            LandingCard::query()->updateOrCreate(
                ['section_slug' => 'ecosystem', 'title' => $row['title']],
                [
                    'description' => $row['description'],
                    'icon' => $row['icon'],
                    'link_url' => $row['link_url'],
                    'sort_order' => $row['sort_order'],
                    'is_active' => true,
                ],
            );
        }

        $topCategories = PostCategory::query()
            ->whereNull('parent_id')
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        $order = 0;
        foreach ($topCategories as $category) {
            LandingCard::query()->updateOrCreate(
                ['section_slug' => 'directions', 'post_category_id' => $category->id],
                [
                    'title' => $category->name,
                    'description' => null,
                    'icon' => $this->iconForCategory($category->icon),
                    'link_url' => '/categories/'.$category->id,
                    'sort_order' => $order++,
                    'is_active' => true,
                ],
            );
        }
    }

    private function iconForCategory(?string $icon): string
    {
        if (! $icon) {
            return 'Box';
        }

        if (str_contains($icon, '-')) {
            return implode('', array_map(static fn (string $p) => ucfirst(strtolower($p)), explode('-', $icon)));
        }

        return ucfirst(strtolower($icon));
    }
}

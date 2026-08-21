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
        $this->seedSection('hero', [
            'eyebrow' => 'МоДелизМ',
            'title' => 'Маркетплейс, лента и сообщество для моделистов',
            'subtitle' => 'Покупайте модели и запчасти, публикуйте сборки, находите клубы и общайтесь с моделистами по всей России.',
            'media_url' => '/videos/herovideo.mp4',
            'is_enabled' => true,
        ], [
            ['title' => 'Объявления', 'icon' => 'Search', 'link_url' => '/ads', 'sort_order' => 0],
        ]);

        $this->seedSection('ecosystem', [
            'eyebrow' => 'Экосистема для моделистов',
            'title' => 'Что есть в МоДелизМ',
            'subtitle' => 'Шесть инструментов, которые закрывают повседневные задачи моделиста — от покупки детали до участия в гонках.',
            'is_enabled' => true,
        ], [
            ['title' => 'Объявления', 'description' => 'Покупка и продажа моделей, запчастей и техники как на Авито.', 'icon' => 'Megaphone', 'link_url' => '/ads', 'sort_order' => 0],
            ['title' => 'Лента публикаций', 'description' => 'Проекты, сборки, фото и видео других моделистов.', 'icon' => 'Newspaper', 'link_url' => '/feed', 'sort_order' => 1],
            ['title' => 'Сообщества', 'description' => 'Клубы по интересам: RC, авиа, суда, электроника.', 'icon' => 'Users2', 'link_url' => '/communities', 'sort_order' => 2],
            ['title' => 'Каналы', 'description' => 'Официальные каналы брендов, магазинов и экспертов.', 'icon' => 'Radio', 'link_url' => '/channels', 'sort_order' => 3],
            ['title' => 'Мессенджер', 'description' => 'Личные и групповые чаты внутри платформы.', 'icon' => 'MessageSquare', 'link_url' => '/messenger', 'sort_order' => 4],
            ['title' => 'Обзоры', 'description' => 'Видеообзоры моделей, сборок и техники от участников сообщества.', 'icon' => 'Clapperboard', 'link_url' => '/reviews', 'sort_order' => 5],
        ]);

        $this->seedSection('listings', [
            'eyebrow' => 'Маркетплейс',
            'title' => 'Популярные объявления',
            'subtitle' => null,
            'is_enabled' => true,
        ]);

        $this->seedSection('directions', [
            'eyebrow' => 'Направления',
            'title' => 'Всё, что движется и летает',
            'subtitle' => null,
            'is_enabled' => true,
        ]);

        $this->seedSection('steps', [
            'eyebrow' => 'Как это работает',
            'title' => 'Три шага до сообщества',
            'subtitle' => null,
            'is_enabled' => true,
        ], [
            ['title' => 'Выберите направление', 'description' => 'Авиация, авто, суда, железные дороги — отметьте, что вам близко.', 'icon' => 'Compass', 'link_url' => '/categories', 'sort_order' => 0],
            ['title' => 'Найдите модель или деталь', 'description' => 'Объявления, проверенные продавцы, избранное и безопасная сделка.', 'icon' => 'Search', 'link_url' => '/ads', 'sort_order' => 1],
            ['title' => 'Общайтесь и показывайте сборки', 'description' => 'Лента, сообщества и мессенджер — весь моделизм в одном месте.', 'icon' => 'Users2', 'link_url' => '/feed', 'sort_order' => 2],
        ]);

        $this->seedSection('why', [
            'eyebrow' => 'Почему МоДелизМ',
            'title' => 'Почему моделисты выбирают нас',
            'subtitle' => null,
            'is_enabled' => true,
        ], [
            ['title' => 'Только моделизм', 'description' => 'Никакого шума — лента и объявления строго по теме.', 'icon' => 'Focus', 'sort_order' => 0],
            ['title' => 'Живое сообщество', 'description' => 'Клубы, эксперты и продавцы с рейтингом и историей сделок.', 'icon' => 'Users2', 'sort_order' => 1],
            ['title' => 'Всё в одном месте', 'description' => 'Купить, продать, обсудить и договориться — без внешних сервисов.', 'icon' => 'LayoutGrid', 'sort_order' => 2],
            ['title' => 'Прямое общение', 'description' => 'Встроенный мессенджер с продавцами и клубами.', 'icon' => 'MessageSquare', 'sort_order' => 3],
        ]);

        $this->seedSection('pricing', [
            'eyebrow' => 'Тарифы',
            'title' => 'Простая подписка',
            'subtitle' => 'Базовые возможности бесплатны. Подписка снимает ограничения.',
            'is_enabled' => true,
        ]);

        $this->seedSection('faq', [
            'eyebrow' => 'Вопросы',
            'title' => 'Часто спрашивают',
            'subtitle' => null,
            'is_enabled' => true,
        ]);

        $this->seedDirectionCardsFromCategories();
    }

    /**
     * @param  array<string, mixed>  $attrs
     * @param  list<array<string, mixed>>  $cards
     */
    private function seedSection(string $slug, array $attrs, array $cards = []): void
    {
        LandingSection::query()->firstOrCreate(['slug' => $slug], $attrs);

        foreach ($cards as $row) {
            LandingCard::query()->firstOrCreate(
                ['section_slug' => $slug, 'title' => $row['title']],
                [
                    'description' => $row['description'] ?? null,
                    'icon' => $row['icon'] ?? 'Box',
                    'link_url' => $row['link_url'] ?? null,
                    'sort_order' => $row['sort_order'] ?? 0,
                    'is_active' => true,
                ],
            );
        }
    }

    private function seedDirectionCardsFromCategories(): void
    {
        $topCategories = PostCategory::query()
            ->whereNull('parent_id')
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        $order = (int) LandingCard::query()->where('section_slug', 'directions')->max('sort_order');

        foreach ($topCategories as $category) {
            $created = LandingCard::query()->firstOrCreate(
                ['section_slug' => 'directions', 'post_category_id' => $category->id],
                [
                    'title' => $category->name,
                    'description' => null,
                    'icon' => $this->iconForCategory($category->icon),
                    'link_url' => '/categories/'.$category->id,
                    'sort_order' => $order + 1,
                    'is_active' => true,
                ],
            );
            if ($created->wasRecentlyCreated) {
                $order++;
            }
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

<?php

namespace Database\Seeders;

use App\Enums\CommunityMemberRole;
use App\Enums\CommunityStatus;
use App\Models\City;
use App\Models\Community;
use App\Models\CommunityCategory;
use App\Models\ListingCategory;
use App\Models\PostCategory;
use App\Models\Tag;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Seeder;

class ReferenceDataSeeder extends Seeder
{
    public function run(): void
    {
        $this->seedPostCategories();
        $this->seedCommunityCategories();
        $this->seedListingCategories();
        $this->seedCities();
        $this->seedTags();
        $this->seedDemoCommunities();
    }

    private function seedPostCategories(): void
    {
        $this->seedTree(PostCategory::class, [
            ['slug' => 'aviation', 'name' => 'Авиация', 'icon' => 'plane', 'children' => [
                ['slug' => 'aviation-wwii', 'name' => 'Вторая мировая'],
                ['slug' => 'aviation-modern', 'name' => 'Современная авиация'],
                ['slug' => 'aviation-helicopters', 'name' => 'Вертолёты'],
                ['slug' => 'aviation-civil', 'name' => 'Гражданская авиация'],
            ]],
            ['slug' => 'armor', 'name' => 'Бронетехника', 'icon' => 'tank', 'children' => [
                ['slug' => 'armor-tanks', 'name' => 'Танки'],
                ['slug' => 'armor-apc', 'name' => 'БТР и БМП'],
                ['slug' => 'armor-artillery', 'name' => 'Артиллерия'],
            ]],
            ['slug' => 'ships', 'name' => 'Корабли', 'icon' => 'ship', 'children' => [
                ['slug' => 'ships-warships', 'name' => 'Военные корабли'],
                ['slug' => 'ships-submarines', 'name' => 'Подводные лодки'],
                ['slug' => 'ships-civil', 'name' => 'Гражданский флот'],
            ]],
            ['slug' => 'vehicles', 'name' => 'Автомобили и мото', 'children' => [
                ['slug' => 'vehicles-cars', 'name' => 'Легковые'],
                ['slug' => 'vehicles-trucks', 'name' => 'Грузовые и спецтехника'],
                ['slug' => 'vehicles-moto', 'name' => 'Мотоциклы'],
            ]],
            ['slug' => 'figures', 'name' => 'Фигурки', 'children' => [
                ['slug' => 'figures-historical', 'name' => 'Исторические'],
                ['slug' => 'figures-fantasy', 'name' => 'Фэнтези и sci-fi'],
                ['slug' => 'figures-busts', 'name' => 'Бюсты'],
            ]],
            ['slug' => 'dioramas', 'name' => 'Диорамы'],
            ['slug' => 'techniques', 'name' => 'Техники и мастер-классы', 'children' => [
                ['slug' => 'techniques-painting', 'name' => 'Покраска'],
                ['slug' => 'techniques-weathering', 'name' => 'Weathering'],
                ['slug' => 'techniques-scratch', 'name' => 'Скрайбилдинг'],
            ]],
            ['slug' => 'reviews', 'name' => 'Обзоры наборов'],
            ['slug' => 'events', 'name' => 'Выставки и события'],
            ['slug' => 'workshop', 'name' => 'Мастерская'],
        ]);
    }

    private function seedCommunityCategories(): void
    {
        $this->seedTree(CommunityCategory::class, [
            ['slug' => 'by-scale', 'name' => 'По масштабу', 'children' => [
                ['slug' => 'scale-172', 'name' => '1/72'],
                ['slug' => 'scale-148', 'name' => '1/48'],
                ['slug' => 'scale-135', 'name' => '1/35'],
                ['slug' => 'scale-132', 'name' => '1/32'],
                ['slug' => 'scale-116', 'name' => '1/16'],
            ]],
            ['slug' => 'by-theme', 'name' => 'По тематике', 'children' => [
                ['slug' => 'theme-historical', 'name' => 'Историческая'],
                ['slug' => 'theme-scifi', 'name' => 'Sci-Fi'],
                ['slug' => 'theme-fantasy', 'name' => 'Фэнтези'],
                ['slug' => 'theme-railway', 'name' => 'Железные дороги'],
            ]],
            ['slug' => 'regional', 'name' => 'Региональные клубы', 'children' => [
                ['slug' => 'regional-moscow', 'name' => 'Москва и область'],
                ['slug' => 'regional-spb', 'name' => 'Санкт-Петербург'],
                ['slug' => 'regional-regions', 'name' => 'Другие регионы'],
            ]],
            ['slug' => 'official', 'name' => 'Официальные сообщества'],
        ]);
    }

    private function seedListingCategories(): void
    {
        $this->seedTree(ListingCategory::class, [
            ['slug' => 'kits', 'name' => 'Наборы', 'children' => [
                ['slug' => 'kits-new', 'name' => 'Новые', 'listing_price_cents' => 0],
                ['slug' => 'kits-used', 'name' => 'Б/у', 'listing_price_cents' => 0],
                ['slug' => 'kits-rare', 'name' => 'Редкие и коллекционные', 'listing_price_cents' => 50000],
            ]],
            ['slug' => 'built', 'name' => 'Собранные модели', 'listing_price_cents' => 0],
            ['slug' => 'tools', 'name' => 'Инструмент', 'listing_price_cents' => 0],
            ['slug' => 'paints', 'name' => 'Краски и химия', 'listing_price_cents' => 0],
            ['slug' => 'decals', 'name' => 'Декали и маски', 'listing_price_cents' => 0],
            ['slug' => 'spare-parts', 'name' => 'Запчасти и конверсии', 'listing_price_cents' => 0],
            ['slug' => 'literature', 'name' => 'Литература', 'listing_price_cents' => 0],
        ]);
    }

    private function seedCities(): void
    {
        $cities = [
            ['name' => 'Москва', 'region' => 'Москва', 'slug' => 'moscow', 'sort_order' => 1],
            ['name' => 'Санкт-Петербург', 'region' => 'Ленинградская область', 'slug' => 'saint-petersburg', 'sort_order' => 2],
            ['name' => 'Новосибирск', 'region' => 'Новосибирская область', 'slug' => 'novosibirsk', 'sort_order' => 3],
            ['name' => 'Екатеринбург', 'region' => 'Свердловская область', 'slug' => 'yekaterinburg', 'sort_order' => 4],
            ['name' => 'Казань', 'region' => 'Республика Татарстан', 'slug' => 'kazan', 'sort_order' => 5],
            ['name' => 'Нижний Новгород', 'region' => 'Нижегородская область', 'slug' => 'nizhny-novgorod', 'sort_order' => 6],
            ['name' => 'Красноярск', 'region' => 'Красноярский край', 'slug' => 'krasnoyarsk', 'sort_order' => 7],
            ['name' => 'Самара', 'region' => 'Самарская область', 'slug' => 'samara', 'sort_order' => 8],
            ['name' => 'Ростов-на-Дону', 'region' => 'Ростовская область', 'slug' => 'rostov-on-don', 'sort_order' => 9],
            ['name' => 'Краснодар', 'region' => 'Краснодарский край', 'slug' => 'krasnodar', 'sort_order' => 10],
            ['name' => 'Воронеж', 'region' => 'Воронежская область', 'slug' => 'voronezh', 'sort_order' => 11],
            ['name' => 'Пермь', 'region' => 'Пермский край', 'slug' => 'perm', 'sort_order' => 12],
            ['name' => 'Волгоград', 'region' => 'Волгоградская область', 'slug' => 'volgograd', 'sort_order' => 13],
            ['name' => 'Уфа', 'region' => 'Республика Башкортостан', 'slug' => 'ufa', 'sort_order' => 14],
            ['name' => 'Тюмень', 'region' => 'Тюменская область', 'slug' => 'tyumen', 'sort_order' => 15],
        ];

        foreach ($cities as $city) {
            City::updateOrCreate(['slug' => $city['slug']], array_merge($city, ['is_active' => true]));
        }
    }

    private function seedTags(): void
    {
        foreach (['tamiya', 'dragon', 'airfix', 'revell', 'zvezda', 'miniart', '1-35', '1-72', 'weathering', 'diorama'] as $tag) {
            Tag::updateOrCreate(
                ['slug' => $tag],
                ['name' => str_replace('-', '/', $tag), 'usage_count' => 0],
            );
        }
    }

    private function seedDemoCommunities(): void
    {
        $category = CommunityCategory::query()->where('slug', 'official')->first()
            ?? CommunityCategory::query()->first();

        if (! $category) {
            return;
        }

        $community = Community::updateOrCreate(
            ['slug' => 'modelizmclub'],
            [
                'category_id' => $category->id,
                'name' => 'ModelizmClub',
                'description' => 'Официальное сообщество клуба масштабных моделей.',
                'status' => CommunityStatus::Active,
                'is_official' => true,
                'approved_at' => now(),
                'members_count' => 0,
            ],
        );

        $demoUser = User::query()->where('email', 'demo@modelizmclub.ru')->first();
        if ($demoUser && ! $community->members()->where('users.id', $demoUser->id)->exists()) {
            $community->members()->attach($demoUser->id, [
                'role' => CommunityMemberRole::Member->value,
                'joined_at' => now(),
            ]);
            $community->increment('members_count');
        }

        Community::updateOrCreate(
            ['slug' => 'scale-135-russia'],
            [
                'category_id' => CommunityCategory::query()->where('slug', 'scale-135')->value('id') ?? $category->id,
                'name' => '1/35 Россия',
                'description' => 'Сообщество моделистов бронетехники масштаба 1/35.',
                'status' => CommunityStatus::Active,
                'is_official' => false,
                'approved_at' => now(),
            ],
        );
    }

    /**
     * @param  class-string<Model>  $modelClass
     * @param  list<array<string, mixed>>  $nodes
     */
    private function seedTree(string $modelClass, array $nodes, ?int $parentId = null, int $depth = 0, string $pathPrefix = ''): void
    {
        foreach ($nodes as $index => $node) {
            $slug = $node['slug'];
            $path = $pathPrefix !== '' ? "{$pathPrefix}/{$slug}" : $slug;

            $attributes = [
                'name' => $node['name'],
                'icon' => $node['icon'] ?? null,
                'sort_order' => ($index + 1) * 10,
                'depth' => $depth,
                'path' => $path,
                'is_active' => true,
            ];

            if ($modelClass === ListingCategory::class) {
                $attributes['listing_price_cents'] = $node['listing_price_cents'] ?? null;
            }

            /** @var Model $record */
            $record = $modelClass::updateOrCreate(
                ['parent_id' => $parentId, 'slug' => $slug],
                $attributes,
            );

            if (! empty($node['children'])) {
                $this->seedTree($modelClass, $node['children'], (int) $record->getKey(), $depth + 1, $path);
            }
        }
    }
}

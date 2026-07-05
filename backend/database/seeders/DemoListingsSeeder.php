<?php

namespace Database\Seeders;

use App\Enums\ListingStatus;
use App\Models\City;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class DemoListingsSeeder extends Seeder
{
    public function run(): void
    {
        $author = User::query()->where('email', 'demo@modelizmclub.ru')->first();
        $category = ListingCategory::query()->whereNull('parent_id')->where('is_active', true)->first();

        if (! $author || ! $category) {
            return;
        }

        $items = [
            ['title' => 'Двигатель ДВС Picco .21 для багги 1:8', 'price' => 1_800_000, 'city' => 'krasnodar'],
            ['title' => 'Комплект колёс Pro-Line Trencher 1:8 (4 шт)', 'price' => 450_000, 'city' => 'moscow'],
            ['title' => 'Аккумулятор LiPo 6S 5000mAh 50C XT90', 'price' => 320_000, 'city' => 'saint-petersburg'],
            ['title' => 'Рама квадрокоптера iFlight Nazgul5 V3', 'price' => 280_000, 'city' => 'kazan'],
            ['title' => 'Пульт Radiomaster TX16S MKII ELRS', 'price' => 2_200_000, 'city' => 'moscow'],
            ['title' => 'ESC-регулятор Hobbywing Justock 120A', 'price' => 540_000, 'city' => 'krasnodar'],
            ['title' => 'Сервопривод Savox SC-1256TG (титан)', 'price' => 490_000, 'city' => 'novosibirsk'],
            ['title' => 'Комплект декалей для Як-54 (масштаб 1:6)', 'price' => 670_000, 'city' => 'rostov-on-don'],
            ['title' => 'Корпус катера 1:20 из стеклопластика', 'price' => 850_000, 'city' => 'yekaterinburg'],
            ['title' => 'Набор винтов APC 11x5.5E (5 пар)', 'price' => 120_000, 'city' => 'krasnodar'],
        ];

        foreach ($items as $i => $item) {
            $slug = Str::slug($item['title']);
            $city = City::query()->where('slug', $item['city'])->first();

            Listing::query()->updateOrCreate(
                ['uuid' => sprintf('00000000-0000-4000-8000-0000000002%02d', $i + 1)],
                [
                    'user_id' => $author->id,
                    'slug' => $slug,
                    'category_id' => $category->id,
                    'title' => $item['title'],
                    'description' => 'Демо-объявление для production. '.$item['title'],
                    'price_cents' => $item['price'],
                    'city_id' => $city?->id,
                    'status' => ListingStatus::Published,
                    'delivery_methods' => ['СДЭК', 'Почта России'],
                    'contact_via_messenger' => true,
                    'published_at' => now()->subDays($i),
                    'views_count' => 100 + $i * 50,
                    'favorites_count' => $i % 3,
                ],
            );
        }
    }
}

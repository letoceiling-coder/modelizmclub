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
        $city = City::query()->first();

        if (! $author || ! $category) {
            return;
        }

        $items = [
            ['title' => 'Двигатель ДВС Picco .21 для багги 1:8', 'price' => 1800000],
            ['title' => 'Комплект колёс Pro-Line Trencher 1:8', 'price' => 450000],
            ['title' => 'Аккумулятор LiPo 6S 5000mAh', 'price' => 320000],
            ['title' => 'Пульт Radiomaster TX16S MKII', 'price' => 2200000],
            ['title' => 'ESC Hobbywing Justock 120A', 'price' => 540000],
        ];

        foreach ($items as $i => $item) {
            $slug = Str::slug($item['title']);
            Listing::query()->updateOrCreate(
                ['user_id' => $author->id, 'slug' => $slug],
                [
                    'uuid' => sprintf('00000000-0000-4000-8000-0000000002%02d', $i + 1),
                    'category_id' => $category->id,
                    'title' => $item['title'],
                    'description' => 'Демо-объявление для production. '.$item['title'],
                    'price_cents' => $item['price'],
                    'city_id' => $city?->id,
                    'status' => ListingStatus::Published,
                    'delivery_methods' => ['СДЭК', 'Почта России'],
                    'published_at' => now()->subDays($i),
                    'views_count' => 100 + $i * 50,
                ],
            );
        }
    }
}

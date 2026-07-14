<?php

namespace Database\Seeders;

use App\Models\VideoCategory;
use Illuminate\Database\Seeder;

class VideoCategoriesSeeder extends Seeder
{
    public function run(): void
    {
        $categories = [
            ['slug' => 'rc', 'title' => 'RC', 'sort_order' => 10],
            ['slug' => 'aviation', 'title' => 'Авиация', 'sort_order' => 20],
            ['slug' => 'ships', 'title' => 'Суда', 'sort_order' => 30],
        ];

        foreach ($categories as $cat) {
            VideoCategory::query()->updateOrCreate(
                ['slug' => $cat['slug']],
                ['title' => $cat['title'], 'sort_order' => $cat['sort_order']],
            );
        }
    }
}

<?php

namespace Database\Seeders;

use App\Enums\ContentStatus;
use App\Models\Community;
use App\Models\Post;
use App\Models\PostCategory;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class DemoFeedSeeder extends Seeder
{
    public function run(): void
    {
        $author = User::query()->where('email', 'demo@modelizmclub.ru')->first();
        if (! $author) {
            return;
        }

        $community = Community::query()->where('slug', 'modelizmclub')->first();
        $categories = PostCategory::query()
            ->whereNull('parent_id')
            ->where('is_active', true)
            ->get()
            ->keyBy('slug');

        $posts = [
            [
                'uuid' => '00000000-0000-4000-8000-000000000101',
                'slug' => 'aviation',
                'title' => 'Сборка P-51 Mustang 1:48',
                'body' => 'Закончил основную сборку корпуса. Следующий этап — покраска и декали. Делюсь прогрессом и парой лайфхаков по маскировке.',
                'days_ago' => 0,
                'hashtags' => ['p51', '1-48', 'авиация'],
            ],
            [
                'uuid' => '00000000-0000-4000-8000-000000000102',
                'slug' => 'armor',
                'title' => 'Т-34-85 в масштабе 1:35',
                'body' => 'Первый опыт с траками — понадобилось много шпатлёвки, но результат того стоит. Фото до/после в комментариях.',
                'days_ago' => 1,
                'hashtags' => ['t34', '1-35', 'бронетехника'],
            ],
            [
                'uuid' => '00000000-0000-4000-8000-000000000103',
                'slug' => 'ships',
                'title' => 'Крейсер «Аврора» 1:350',
                'body' => 'Долгий, но увлекательный проект. Особое внимание уделил такелажу и мелким деталям палубы.',
                'days_ago' => 2,
                'hashtags' => ['корабли', '1-350'],
            ],
            [
                'uuid' => '00000000-0000-4000-8000-000000000104',
                'slug' => 'aviation',
                'title' => 'Обзор красок для авиамоделей',
                'body' => 'Сравнил три линейки акрила на одной модели. Кратко: где лучше перекрываемость, где проще работать кистью.',
                'days_ago' => 3,
                'hashtags' => ['краски', 'обзор'],
            ],
            [
                'uuid' => '00000000-0000-4000-8000-000000000105',
                'slug' => 'figures',
                'title' => 'Фигурка пилота WWII',
                'body' => 'Прописал лицо масляными и добавил эффект потёртости на кожаной куртке. Первый раз пробовал OSL.',
                'days_ago' => 4,
                'hashtags' => ['фигурки', 'wwii'],
            ],
            [
                'uuid' => '00000000-0000-4000-8000-000000000106',
                'slug' => 'armor',
                'title' => 'Сравнение траков для 1:35',
                'body' => 'Проверил три набора на одном шасси. Кто лучше держит форму и не «плывёт» после сборки.',
                'days_ago' => 5,
                'hashtags' => ['траки', '1-35'],
            ],
            [
                'uuid' => '00000000-0000-4000-8000-000000000107',
                'slug' => 'vehicles',
                'title' => 'ГАЗ-66 в масштабе 1:43',
                'body' => 'Реставрация старой модели: замена деталей, перекраска, добавление патины на кузов.',
                'days_ago' => 7,
                'hashtags' => ['автомобили', '1-43'],
            ],
            [
                'uuid' => '00000000-0000-4000-8000-000000000108',
                'slug' => 'aviation',
                'title' => 'Погодные эффекты на крыле',
                'body' => 'Как добиться реалистичного выцветания камуфляжа без перебора. Мой пошаговый рецепт.',
                'days_ago' => 10,
                'hashtags' => ['погодинг', 'авиация'],
            ],
            [
                'uuid' => '00000000-0000-4000-8000-000000000109',
                'slug' => 'ships',
                'title' => 'Подводная лодка Kilo-class',
                'body' => 'Сборка из коробки с минимальными доработками. Акцент на чистой стыковке корпуса.',
                'days_ago' => 12,
                'hashtags' => ['пл', 'корабли'],
            ],
            [
                'uuid' => '00000000-0000-4000-8000-000000000110',
                'slug' => 'armor',
                'title' => 'Итоги клубной выставки',
                'body' => 'Фотоотчёт с региональной выставки моделистов. Много сильных работ в классе бронетехники.',
                'days_ago' => 14,
                'hashtags' => ['выставка', 'отчёт'],
            ],
        ];

        foreach ($posts as $index => $item) {
            $category = $categories->get($item['slug']);
            if (! $category) {
                continue;
            }

            $publishedAt = now()->subDays($item['days_ago'])->subHours($index);

            $post = Post::query()->firstOrNew(['uuid' => $item['uuid']]);
            $post->fill([
                'user_id' => $author->id,
                'community_id' => $community?->id,
                'category_id' => $category->id,
                'title' => $item['title'],
                'body' => $item['body'],
                'status' => ContentStatus::Published,
                'published_at' => $publishedAt,
            ]);
            $post->save();

            $tagIds = [];
            foreach ($item['hashtags'] as $name) {
                $slug = Str::slug($name);
                $tag = \App\Models\Tag::query()->firstOrCreate(
                    ['slug' => $slug],
                    ['name' => $name, 'usage_count' => 0],
                );
                $tagIds[] = $tag->id;
            }
            $post->tags()->sync($tagIds);
        }

        // Keep the community's denormalized post counter consistent with the
        // posts we just seeded (idempotent — recomputed from real rows).
        if ($community) {
            $community->posts_count = Post::query()
                ->where('community_id', $community->id)
                ->where('status', ContentStatus::Published)
                ->count();
            $community->save();
        }
    }
}

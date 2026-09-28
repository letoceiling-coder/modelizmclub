<?php

namespace Tests\Feature;

use App\Models\PostCategory;
use App\Support\CategoryOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Catalog\Services\CategoryTaxonomyService;
use Tests\TestCase;

/**
 * Сброс кеша каталога отдельной командой.
 *
 * Проверяется не «вызвался ли метод», а то, ради чего команда заведена:
 * после сброса дерево отдаёт новое состояние, а не вчерашнее. Косвенная
 * проверка тут бесполезна — она была бы зелёной и с `tinker`, который на
 * проде падал.
 */
class FlushCatalogCacheCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_command_makes_the_tree_show_a_fresh_name(): void
    {
        $узел = PostCategory::query()->create([
            'name' => 'Авиация',
            'slug' => 'aviaciya',
            'sort_order' => 10,
            'is_active' => true,
            'in_feed' => true,
            'in_listings' => true,
            'in_communities' => true,
        ]);
        app(CategoryTaxonomyService::class)->syncFromPostCategory($узел);
        CategoryOrder::set(CategoryOrder::ALPHA);

        // Первое чтение кладёт дерево в кеш.
        $this->assertSame(
            ['Авиация'],
            collect($this->getJson('/api/v1/categories/posts')->json('data'))->pluck('name')->all(),
        );

        // Правка мимо приложения — как это делает команда наполнения или
        // прямой UPDATE. Кеш о ней не знает.
        PostCategory::query()->whereKey($узел->id)->update(['name' => 'Авиамоделизм']);

        $this->assertSame(
            ['Авиация'],
            collect($this->getJson('/api/v1/categories/posts')->json('data'))->pluck('name')->all(),
            'До сброса дерево обязано отдавать старое имя — иначе проверка ничего не проверяет.',
        );

        $this->artisan('catalog:flush-cache')->assertSuccessful();

        $this->assertSame(
            ['Авиамоделизм'],
            collect($this->getJson('/api/v1/categories/posts')->json('data'))->pluck('name')->all(),
        );
    }
}

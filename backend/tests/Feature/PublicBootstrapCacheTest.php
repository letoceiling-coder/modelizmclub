<?php

namespace Tests\Feature;

use App\Models\FaqArticle;
use App\Models\FaqCategory;
use App\Models\SystemSetting;
use App\Models\User;
use App\Support\SiteBranding;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Modules\Catalog\Services\CatalogService;
use Modules\PublicContent\Services\PublicBootstrapService;
use Tests\TestCase;

/**
 * Bootstrap из Redis и его сброс.
 *
 * Кеш без сброса добавил бы к 15 с Nitro и 15 с браузера ещё 15 с
 * устаревания после сохранения в админке. Поэтому проверяется в первую
 * очередь не попадание, а то, что каждая дорога записи его сбрасывает — и
 * особенно перестановки порядка: они пишут массовым update() мимо событий
 * модели, и без явного forget() их правка висела бы до истечения TTL.
 */
class PublicBootstrapCacheTest extends TestCase
{
    use RefreshDatabase;

    private function service(): PublicBootstrapService
    {
        return app(PublicBootstrapService::class);
    }

    public function test_second_call_does_not_touch_the_database(): void
    {
        $this->service()->payload();

        DB::flushQueryLog();
        DB::enableQueryLog();
        $this->service()->payload();

        $this->assertSame([], DB::getQueryLog());
    }

    public function test_saving_a_setting_drops_the_cache(): void
    {
        $this->service()->payload();

        SystemSetting::query()->updateOrCreate(
            ['key' => SiteBranding::SETTING_KEY],
            ['value' => ['name' => 'Новое имя'], 'group' => 'branding'],
        );

        DB::flushQueryLog();
        DB::enableQueryLog();
        $this->service()->payload();

        $this->assertNotSame([], DB::getQueryLog(), 'после записи ответ взят из кеша');
    }

    public function test_category_flush_drops_the_cache(): void
    {
        $this->service()->payload();
        CatalogService::flushCache();

        DB::flushQueryLog();
        DB::enableQueryLog();
        $this->service()->payload();

        $this->assertNotSame([], DB::getQueryLog());
    }

    public function test_faq_reorder_through_admin_drops_the_cache(): void
    {
        $category = FaqCategory::query()->create([
            'slug' => 'landing', 'name' => 'Лендинг', 'sort_order' => 1, 'is_active' => true,
        ]);
        $first = FaqArticle::query()->create([
            'category_id' => $category->id, 'question' => 'Первый', 'answer' => 'A', 'sort_order' => 1, 'is_active' => true,
        ]);
        $second = FaqArticle::query()->create([
            'category_id' => $category->id, 'question' => 'Второй', 'answer' => 'B', 'sort_order' => 2, 'is_active' => true,
        ]);

        $order = fn (): array => collect($this->service()->payload()['landing_faq'][0]['articles'])
            ->pluck('question')->all();

        $this->assertSame(['Первый', 'Второй'], $order());

        $admin = User::factory()->create(['role' => 'admin']);
        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/v1/admin/faq/articles/reorder', ['items' => [
                ['id' => $first->id, 'sort_order' => 2],
                ['id' => $second->id, 'sort_order' => 1],
            ]])
            ->assertOk();

        $this->assertSame(['Второй', 'Первый'], $order(), 'перестановка не сбросила кеш bootstrap');
    }
}

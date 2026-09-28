<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\PostCategory;
use App\Models\User;
use App\Support\CategoryOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Modules\Catalog\Services\CatalogService;
use Modules\Catalog\Services\CategoryTaxonomyService;
use Tests\TestCase;

/**
 * Порядок категорий: по алфавиту или вручную.
 *
 * Главное здесь — не «сортируется ли», а «одинаково ли»: админка и сайт
 * должны отдавать один и тот же ряд. Это единственное утверждение,
 * которое нельзя проверить, глядя на один экран.
 */
class CategoryOrderTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        CatalogService::flushCache();
    }

    private function direction(string $name, string $slug, int $sortOrder, ?PostCategory $parent = null): PostCategory
    {
        $category = PostCategory::query()->create([
            'parent_id' => $parent?->id,
            'name' => $name,
            'slug' => $slug,
            'sort_order' => $sortOrder,
            'is_active' => true,
            'in_feed' => true,
            'in_listings' => true,
            'in_communities' => true,
        ]);
        app(CategoryTaxonomyService::class)->syncFromPostCategory($category);

        return $category->fresh();
    }

    private function owner(): User
    {
        return User::factory()->create([
            'role' => UserRole::Owner,
            'status' => UserStatus::Active,
            'email_verified_at' => now(),
        ]);
    }

    /** Названия корней так, как их отдаёт админка. */
    private function адмПорядок(User $admin): array
    {
        $ответ = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/v1/admin/categories/post?per_page=200')
            ->assertOk()
            ->json('data.data');

        return collect($ответ)
            ->filter(fn ($c) => $c['parent_id'] === null)
            ->pluck('name')
            ->values()
            ->all();
    }

    /** Названия корней так, как их отдаёт сайт. */
    private function сайтПорядок(): array
    {
        $ответ = $this->getJson('/api/v1/categories/posts')->assertOk()->json('data');

        return collect($ответ)->pluck('name')->values()->all();
    }

    public function test_the_icu_russian_collation_exists(): void
    {
        /*
         * Отдельной проверкой, а не косвенно: без коллации алфавитный
         * порядок молча превратился бы в порядок байтов, где «Ё» стоит
         * впереди «А». Пусть это будет красный тест, а не переставленный
         * каталог, о котором никто не узнает.
         */
        $есть = DB::table('pg_collation')->where('collname', CategoryOrder::COLLATION)->exists();

        $this->assertTrue($есть, 'В базе нет коллации '.CategoryOrder::COLLATION.' — алфавитный порядок работать не будет.');
    }

    public function test_alphabetical_order_is_russian_and_not_byte_order(): void
    {
        // Ряд подобран так, чтобы порядок байтов дал другой ответ:
        // «Ёлка» (U+0401) по байтам встаёт впереди «Авиации» (U+0410),
        // строчные — после прописных, цифры — после кириллицы.
        $this->direction('Яблоко', 'yabloko', 10);
        $this->direction('Ёлка', 'yolka', 20);
        $this->direction('Авиация', 'aviaciya', 30);
        $this->direction('Ель', 'el', 40);
        $this->direction('Weathering', 'weathering', 50);
        $this->direction('3D-печать', '3d-print', 60);

        CategoryOrder::set(CategoryOrder::ALPHA);

        /*
         * Порядок ICU для русского: цифры, кириллица, латиница. Латиница
         * в конце — не оплошность, а правило ru-коллации; проверено и на
         * боевой базе тем же запросом.
         */
        $this->assertSame(
            ['3D-печать', 'Авиация', 'Ёлка', 'Ель', 'Яблоко', 'Weathering'],
            $this->сайтПорядок(),
        );
    }

    public function test_admin_and_site_show_the_same_order_in_both_modes(): void
    {
        $this->direction('Яблоко', 'yabloko', 10);
        $this->direction('Ёлка', 'yolka', 20);
        $this->direction('Авиация', 'aviaciya', 30);
        $this->direction('Weathering', 'weathering', 40);

        $admin = $this->owner();

        foreach ([CategoryOrder::ALPHA, CategoryOrder::MANUAL] as $режим) {
            CategoryOrder::set($режим);

            $this->assertSame(
                $this->сайтПорядок(),
                $this->адмПорядок($admin),
                "При режиме «{$режим}» админка и сайт показывают разный порядок.",
            );
        }
    }

    public function test_manual_mode_keeps_the_numbers_it_was_given(): void
    {
        $this->direction('Яблоко', 'yabloko', 10);
        $this->direction('Авиация', 'aviaciya', 20);

        CategoryOrder::set(CategoryOrder::MANUAL);

        // Ручной порядок — это именно номера, а не алфавит: «Яблоко»
        // первым, потому что у него десятка.
        $this->assertSame(['Яблоко', 'Авиация'], $this->сайтПорядок());

        // И переключение туда-обратно номеров не теряет.
        CategoryOrder::set(CategoryOrder::ALPHA);
        $this->assertSame(['Авиация', 'Яблоко'], $this->сайтПорядок());

        CategoryOrder::set(CategoryOrder::MANUAL);
        $this->assertSame(['Яблоко', 'Авиация'], $this->сайтПорядок());
    }

    public function test_a_new_category_lands_in_its_place_at_once(): void
    {
        $this->direction('Авиация', 'aviaciya', 10);
        $this->direction('Яблоко', 'yabloko', 20);
        CategoryOrder::set(CategoryOrder::ALPHA);

        $admin = $this->owner();

        // Номер новой категории — последний в ряду, как его ставит админка.
        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/v1/admin/categories/post', [
                'name' => 'Бюсты',
                'slug' => 'byusty',
                'sort_order' => 30,
                'is_active' => true,
            ])
            ->assertCreated();

        // Между «Авиацией» и «Яблоком», хотя номер у неё самый большой.
        $this->assertSame(['Авиация', 'Бюсты', 'Яблоко'], $this->адмПорядок($admin));
        $this->assertSame(['Авиация', 'Бюсты', 'Яблоко'], $this->сайтПорядок());
    }

    public function test_renaming_moves_the_category_by_itself(): void
    {
        $this->direction('Авиация', 'aviaciya', 10);
        $яблоко = $this->direction('Яблоко', 'yabloko', 20);
        CategoryOrder::set(CategoryOrder::ALPHA);

        $admin = $this->owner();
        $this->assertSame(['Авиация', 'Яблоко'], $this->адмПорядок($admin));

        $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/v1/admin/categories/post/{$яблоко->id}", [
                'name' => 'Абажуры',
                'slug' => 'abazhury',
                'sort_order' => 20,
                'is_active' => true,
            ])
            ->assertOk();

        // Номер прежний — 20, а узел переехал: место задаёт название.
        $this->assertSame(['Абажуры', 'Авиация'], $this->адмПорядок($admin));
        $this->assertSame(['Абажуры', 'Авиация'], $this->сайтПорядок());
    }

    public function test_children_are_alphabetical_too(): void
    {
        $авиация = $this->direction('Авиация', 'aviaciya', 10);
        $this->direction('Яки', 'yaki', 10, $авиация);
        $this->direction('Вертолёты', 'vertolety', 20, $авиация);
        $this->direction('Бипланы', 'biplany', 30, $авиация);

        CategoryOrder::set(CategoryOrder::ALPHA);

        $дети = collect($this->getJson('/api/v1/categories/posts')->assertOk()->json('data'))
            ->firstWhere('name', 'Авиация')['children'] ?? [];

        $this->assertSame(
            ['Бипланы', 'Вертолёты', 'Яки'],
            collect($дети)->pluck('name')->all(),
        );
    }

    public function test_manual_reorder_is_refused_while_alphabetical(): void
    {
        $а = $this->direction('Авиация', 'aviaciya', 10);
        $я = $this->direction('Яблоко', 'yabloko', 20);
        CategoryOrder::set(CategoryOrder::ALPHA);

        $admin = $this->owner();

        /*
         * Отказ на сервере, а не спрятанная кнопка: при алфавите админка
         * стрелок не рисует, но запрос можно послать и без неё.
         */
        $this->actingAs($admin, 'sanctum')
            ->patchJson('/api/v1/admin/categories/post/reorder', ['ids' => [$я->id, $а->id]])
            ->assertStatus(422);

        // Номера не тронуты.
        $this->assertSame(10, (int) $а->fresh()->sort_order);
        $this->assertSame(20, (int) $я->fresh()->sort_order);

        // А при ручном порядке та же перестановка проходит.
        CategoryOrder::set(CategoryOrder::MANUAL);
        $this->actingAs($admin, 'sanctum')
            ->patchJson('/api/v1/admin/categories/post/reorder', ['ids' => [$я->id, $а->id]])
            ->assertOk();

        $this->assertSame(['Яблоко', 'Авиация'], $this->сайтПорядок());
    }

    public function test_the_switch_is_saved_and_read_back(): void
    {
        $admin = $this->owner();

        // Умолчание — алфавит, даже когда строки настройки ещё нет.
        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/v1/admin/categories/sort-mode')
            ->assertOk()
            ->assertJsonPath('data.mode', CategoryOrder::ALPHA);

        $this->actingAs($admin, 'sanctum')
            ->putJson('/api/v1/admin/categories/sort-mode', ['mode' => CategoryOrder::MANUAL])
            ->assertOk()
            ->assertJsonPath('data.mode', CategoryOrder::MANUAL);

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/v1/admin/categories/sort-mode')
            ->assertOk()
            ->assertJsonPath('data.mode', CategoryOrder::MANUAL);

        // Выбор попадает в аудит: он меняет порядок на всём сайте.
        $this->assertTrue(
            DB::table('audit_logs')->where('action', 'admin.categories.sort_mode')->exists(),
        );

        $this->actingAs($admin, 'sanctum')
            ->putJson('/api/v1/admin/categories/sort-mode', ['mode' => 'по-настроению'])
            ->assertStatus(422);
    }
}

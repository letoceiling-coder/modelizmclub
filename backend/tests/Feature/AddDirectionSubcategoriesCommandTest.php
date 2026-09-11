<?php

namespace Tests\Feature;

use App\Console\Commands\AddDirectionSubcategoriesCommand;
use App\Models\CommunityCategory;
use App\Models\ListingCategory;
use App\Models\PostCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Команда пишет в боевое дерево направлений и в два зеркала. Тесты держат
 * три обещания из её описания: сухой прогон не пишет; уже отражённое
 * направление не синхронизируется целиком; чужая строка с тем же slug
 * останавливает команду до записи.
 */
class AddDirectionSubcategoriesCommandTest extends TestCase
{
    use RefreshDatabase;

    private function cat(string $name, string $slug, ?PostCategory $parent = null): PostCategory
    {
        return PostCategory::query()->create([
            'name' => $name,
            'slug' => $slug,
            'parent_id' => $parent?->id,
            'depth' => $parent ? (int) $parent->depth + 1 : 0,
            'path' => $parent ? $parent->path.'/'.$slug : $slug,
            'is_active' => true,
        ]);
    }

    /** Родители плана. Авиация уже отражена в каталоге, остальные — нигде. */
    private function tree(): void
    {
        $this->cat('Авиация', 'aviation');
        ListingCategory::query()->create([
            'name' => 'Авиация (каталог)', 'slug' => 'aviation', 'depth' => 0, 'path' => 'aviation', 'is_active' => true,
        ]);

        $armor = $this->cat('Бронетехника', 'armor');
        $this->cat('Танки', 'armor-tanks', $armor);

        foreach ([
            'ships' => 'Корабли', 'vehicles' => 'Автомобили и мото', 'figures' => 'Фигурки',
            'dioramas' => 'Диорамы', 'workshop' => 'Мастерская', 'roboty' => 'Роботы',
            'techniques' => 'Техники и мастер-классы', 'events' => 'Выставки и события', 'reviews' => 'Обзоры наборов',
        ] as $slug => $name) {
            $this->cat($name, $slug);
        }

        $fishing = $this->cat('Рыбалка', 'rybalka');
        $this->cat('Корабли для рыбалки', 'korabli-dlya-rybalki', $fishing);
    }

    private function planned(): int
    {
        return array_sum(array_map('count', AddDirectionSubcategoriesCommand::PLAN));
    }

    public function test_сухой_прогон_ничего_не_пишет(): void
    {
        $this->tree();
        $before = PostCategory::query()->count();

        $this->artisan('categories:add-subcategories', ['--dry-run' => true])->assertExitCode(0);

        $this->assertSame($before, PostCategory::query()->count());
        $this->assertSame(1, ListingCategory::query()->count());
        $this->assertSame(0, CommunityCategory::query()->count());
    }

    public function test_заводит_узлы_под_родителями_и_отражает_их(): void
    {
        $this->tree();
        $before = PostCategory::query()->count();

        $this->artisan('categories:add-subcategories')->assertExitCode(0);

        $this->assertSame($before + $this->planned(), PostCategory::query()->count());

        $buggy = PostCategory::query()->where('slug', 'vehicles-rc-buggy')->firstOrFail();
        $this->assertSame(2, (int) $buggy->depth);
        $this->assertSame('vehicles/vehicles-rc/vehicles-rc-buggy', $buggy->path);

        $mirror = ListingCategory::query()->where('path', $buggy->path)->firstOrFail();
        $this->assertSame('vehicles/vehicles-rc', ListingCategory::query()->find($mirror->parent_id)?->path);
        $this->assertTrue(CommunityCategory::query()->where('path', $buggy->path)->exists());

        // Узел под отражённым направлением цепляется к существующему зеркалу.
        $wwii = ListingCategory::query()->where('path', 'aviation/aviation-wwii')->firstOrFail();
        $this->assertSame('aviation', ListingCategory::query()->find($wwii->parent_id)?->path);
    }

    public function test_отражённое_направление_не_синхронизируется_целиком(): void
    {
        $this->tree();

        $this->artisan('categories:add-subcategories')->assertExitCode(0);

        // Полная синхронизация переписала бы имя зеркала именем направления.
        $this->assertSame('Авиация (каталог)', ListingCategory::query()->where('path', 'aviation')->value('name'));
    }

    public function test_повторный_запуск_ничего_не_добавляет(): void
    {
        $this->tree();
        $this->artisan('categories:add-subcategories')->assertExitCode(0);
        $after = [PostCategory::query()->count(), ListingCategory::query()->count(), CommunityCategory::query()->count()];

        $this->artisan('categories:add-subcategories')->assertExitCode(0);

        $this->assertSame($after, [PostCategory::query()->count(), ListingCategory::query()->count(), CommunityCategory::query()->count()]);
    }

    public function test_чужая_строка_с_тем_же_slug_останавливает_до_записи(): void
    {
        $this->tree();
        ListingCategory::query()->create([
            'name' => 'Чужой раздел', 'slug' => 'ships-sailing', 'depth' => 1, 'path' => 'other/ships-sailing', 'is_active' => true,
        ]);
        $before = PostCategory::query()->count();

        $this->artisan('categories:add-subcategories')->assertExitCode(1);

        $this->assertSame($before, PostCategory::query()->count());
        $this->assertSame('other/ships-sailing', ListingCategory::query()->where('slug', 'ships-sailing')->value('path'));
    }

    public function test_без_родителя_плана_ничего_не_пишет(): void
    {
        $this->cat('Авиация', 'aviation');

        $this->artisan('categories:add-subcategories')->assertExitCode(1);

        $this->assertSame(1, PostCategory::query()->count());
    }
}

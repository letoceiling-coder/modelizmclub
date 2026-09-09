<?php

namespace Tests\Feature;

use App\Models\PostCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Команда правит боевые данные, а покрыта не была — и первый же прогон на
 * проде упал на неверном пространстве имён у CatalogService: класс лежит в
 * Modules\, а импорт был написан на App\Modules\. Ворота этого не увидели,
 * потому что команду не запускал ни один тест.
 *
 * Отсюда первый тест: он просто доводит команду до конца. Ошибки такого рода
 * — опечатка в импорте, забытая зависимость, несуществующий метод — падают
 * на первом же вызове, и чтобы их поймать, достаточно вызова.
 */
class FlattenCategoriesCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_третий_уровень_перевешивается_на_первый(): void
    {
        $root = PostCategory::query()->create([
            'name' => 'Авиация', 'slug' => 'aviation-t', 'depth' => 0, 'path' => 'aviation-t', 'is_active' => true,
        ]);
        $mid = PostCategory::query()->create([
            'name' => 'Гражданская', 'slug' => 'civil-t', 'parent_id' => $root->id, 'depth' => 1,
            'path' => 'aviation-t/civil-t', 'is_active' => true,
        ]);
        $deep = PostCategory::query()->create([
            'name' => 'Ил-6', 'slug' => 'il-6-t', 'parent_id' => $mid->id, 'depth' => 2,
            'path' => 'aviation-t/civil-t/il-6-t', 'is_active' => true,
        ]);

        $this->artisan('categories:flatten')->assertExitCode(0);

        $deep->refresh();
        $this->assertSame($root->id, $deep->parent_id);
        $this->assertSame(1, (int) $deep->depth);
        $this->assertSame('aviation-t/il-6-t', $deep->path);
    }

    /**
     * Оборванная цепочка: parent_id пуст, а path обещает родителя, которого
     * в таблице нет. Ровно случай «ил 6» на проде — родителем становится тот,
     * кого называет первый сегмент пути.
     */
    public function test_оборванная_цепочка_чинится_по_первому_сегменту_пути(): void
    {
        $root = PostCategory::query()->create([
            'name' => 'Авиация', 'slug' => 'aviation-t', 'depth' => 0, 'path' => 'aviation-t', 'is_active' => true,
        ]);
        $orphan = PostCategory::query()->create([
            'name' => 'Ил-6', 'slug' => 'il-6-t', 'parent_id' => null, 'depth' => 2,
            'path' => 'aviation-t/nonexistent/il-6-t', 'is_active' => true,
        ]);

        $this->artisan('categories:flatten')->assertExitCode(0);

        $orphan->refresh();
        $this->assertSame($root->id, $orphan->parent_id);
        $this->assertSame(1, (int) $orphan->depth);
        $this->assertSame('aviation-t/il-6-t', $orphan->path);
    }

    public function test_холостой_прогон_ничего_не_пишет(): void
    {
        PostCategory::query()->create([
            'name' => 'Авиация', 'slug' => 'aviation-t', 'depth' => 0, 'path' => 'aviation-t', 'is_active' => true,
        ]);
        $deep = PostCategory::query()->create([
            'name' => 'Ил-6', 'slug' => 'il-6-t', 'parent_id' => null, 'depth' => 2,
            'path' => 'aviation-t/nonexistent/il-6-t', 'is_active' => true,
        ]);

        $this->artisan('categories:flatten', ['--dry-run' => true])->assertExitCode(0);

        $deep->refresh();
        $this->assertSame(2, (int) $deep->depth);
        $this->assertNull($deep->parent_id);
    }

    /** Повторный прогон на приведённых данных ничего не меняет. */
    public function test_повторный_прогон_идемпотентен(): void
    {
        $root = PostCategory::query()->create([
            'name' => 'Авиация', 'slug' => 'aviation-t', 'depth' => 0, 'path' => 'aviation-t', 'is_active' => true,
        ]);
        $deep = PostCategory::query()->create([
            'name' => 'Ил-6', 'slug' => 'il-6-t', 'parent_id' => null, 'depth' => 2,
            'path' => 'aviation-t/nonexistent/il-6-t', 'is_active' => true,
        ]);

        $this->artisan('categories:flatten')->assertExitCode(0);
        $deep->refresh();
        $after = [$deep->parent_id, (int) $deep->depth, $deep->path];

        $this->artisan('categories:flatten')->assertExitCode(0);
        $deep->refresh();

        $this->assertSame($after, [$deep->parent_id, (int) $deep->depth, $deep->path]);
        $this->assertSame($root->id, $deep->parent_id);
    }
}

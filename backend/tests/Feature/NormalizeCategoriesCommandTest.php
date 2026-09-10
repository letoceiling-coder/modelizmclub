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
 *
 * 10.09 команда сменила работу: раньше сводила деревья к двум уровням,
 * теперь приводит depth и path в согласие с parent_id на любой глубине.
 * Тесты переписаны под неё — прежние проверяли ровно то поведение, которое
 * отменено, и оставить их значило бы закрепить отменённое.
 */
class NormalizeCategoriesCommandTest extends TestCase
{
    use RefreshDatabase;

    /** @return array{PostCategory, PostCategory, PostCategory} */
    private function threeLevels(): array
    {
        $root = PostCategory::query()->create([
            'name' => 'Авиация', 'slug' => 'aviation-t', 'depth' => 0, 'path' => 'aviation-t', 'is_active' => true,
        ]);
        $mid = PostCategory::query()->create([
            'name' => 'Планеры', 'slug' => 'planery-t', 'parent_id' => $root->id, 'depth' => 1,
            'path' => 'aviation-t/planery-t', 'is_active' => true,
        ]);
        $leaf = PostCategory::query()->create([
            'name' => 'Ил-6', 'slug' => 'il-6-t', 'parent_id' => $mid->id, 'depth' => 1,
            'path' => 'aviation-t/il-6-t', 'is_active' => true,
        ]);

        return [$root, $mid, $leaf];
    }

    /** Третий уровень остаётся третьим — раньше команда сносила его в корень. */
    public function test_третий_уровень_сохраняется_и_получает_верные_depth_и_path(): void
    {
        [, , $leaf] = $this->threeLevels();

        $this->artisan('categories:normalize')->assertExitCode(0);

        $leaf->refresh();
        $this->assertSame(2, (int) $leaf->depth);
        $this->assertSame('aviation-t/planery-t/il-6-t', $leaf->path);
    }

    public function test_перевес_меняет_родителя_и_путь(): void
    {
        [$root, $mid, $leaf] = $this->threeLevels();
        $leaf->forceFill(['parent_id' => $root->id])->save();

        $this->artisan('categories:normalize', ['--move' => ['il-6-t:planery-t']])->assertExitCode(0);

        $leaf->refresh();
        $this->assertSame($mid->id, $leaf->parent_id);
        $this->assertSame(2, (int) $leaf->depth);
        $this->assertSame('aviation-t/planery-t/il-6-t', $leaf->path);
    }

    public function test_перевес_в_корень_поднимает_узел(): void
    {
        [, , $leaf] = $this->threeLevels();

        $this->artisan('categories:normalize', ['--move' => ['il-6-t:-']])->assertExitCode(0);

        $leaf->refresh();
        $this->assertNull($leaf->parent_id);
        $this->assertSame(0, (int) $leaf->depth);
        $this->assertSame('il-6-t', $leaf->path);
    }

    /** Несуществующий родитель — отказ, а не молчаливый пропуск. */
    public function test_неизвестный_родитель_валит_прогон(): void
    {
        $this->threeLevels();

        $this->artisan('categories:normalize', ['--move' => ['il-6-t:no-such-parent']])->assertExitCode(1);
    }

    public function test_холостой_прогон_ничего_не_пишет(): void
    {
        [$root, , $leaf] = $this->threeLevels();
        $leaf->forceFill(['parent_id' => $root->id, 'depth' => 9, 'path' => 'ерунда'])->save();

        $this->artisan('categories:normalize', ['--dry-run' => true])->assertExitCode(0);

        $leaf->refresh();
        $this->assertSame(9, (int) $leaf->depth);
        $this->assertSame('ерунда', $leaf->path);
    }

    /**
     * Холостой прогон обязан показывать последствия перевеса, а не только
     * сам перевес: первая версия печатала «il-6 → planery» и считала
     * нормализацию по старому родителю, то есть переехавший узел в выводе
     * не появлялся.
     */
    public function test_холостой_прогон_показывает_последствия_перевеса(): void
    {
        [$root, , $leaf] = $this->threeLevels();
        $leaf->forceFill(['parent_id' => $root->id, 'depth' => 1, 'path' => 'aviation-t/il-6-t'])->save();

        $this->artisan('categories:normalize', ['--dry-run' => true, '--move' => ['il-6-t:planery-t']])
            ->expectsOutputToContain('aviation-t/planery-t/il-6-t')
            ->assertExitCode(0);

        // И при этом ничего не записал.
        $leaf->refresh();
        $this->assertSame($root->id, $leaf->parent_id);
        $this->assertSame('aviation-t/il-6-t', $leaf->path);
    }

    public function test_повторный_прогон_идемпотентен(): void
    {
        $this->threeLevels();

        $this->artisan('categories:normalize')->assertExitCode(0);
        $snapshot = PostCategory::query()->orderBy('id')->get(['id', 'parent_id', 'depth', 'path'])->toArray();

        $this->artisan('categories:normalize')->assertExitCode(0);

        $this->assertSame($snapshot, PostCategory::query()->orderBy('id')->get(['id', 'parent_id', 'depth', 'path'])->toArray());
    }

    /** Кольцо в parent_id не должно уводить команду в бесконечный обход. */
    public function test_кольцо_не_вешает_команду(): void
    {
        $a = PostCategory::query()->create([
            'name' => 'A', 'slug' => 'a-t', 'depth' => 0, 'path' => 'a-t', 'is_active' => true,
        ]);
        $b = PostCategory::query()->create([
            'name' => 'B', 'slug' => 'b-t', 'parent_id' => $a->id, 'depth' => 1, 'path' => 'a-t/b-t', 'is_active' => true,
        ]);
        $a->forceFill(['parent_id' => $b->id])->save();

        $this->artisan('categories:normalize')->assertExitCode(1);
    }
}

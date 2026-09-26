<?php

namespace Tests\Feature;

use App\Models\Community;
use App\Models\CommunityCategory;
use App\Models\PostCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Catalog\Services\CatalogService;
use Tests\TestCase;

/**
 * Справочник категорий сообществ покрывает то, чем сообщества размечены.
 *
 * В таблице `community_categories` два разных набора. Своя ось — «По
 * масштабу», «По тематике», «Региональные клубы» и подобное, ею размечены
 * все сообщества. Зеркала направлений (Авиация, Авто, Корабли) заводит
 * механизм зеркалирования, и на них указывает
 * `post_categories.community_category_id`.
 *
 * До 27.09 справочник отдавал зеркала: выбирать предлагали из одной оси, а
 * поле `category_id` заполнялось из другой. Приёмка замерила последствие —
 * пересечение пусто, ноль из восемнадцати сообществ относится хоть к одной
 * предлагаемой категории, и фильтр по категории не находит ничего.
 *
 * Тест проверяет не список имён, а связь: у каждого сообщества его категория
 * обязана быть в справочнике. Список имён пришлось бы обновлять руками, связь
 * обновлять не нужно.
 */
class CommunityCategoryAxisTest extends TestCase
{
    use RefreshDatabase;

    private function своя(string $name): CommunityCategory
    {
        return CommunityCategory::query()->create([
            'name' => $name,
            'slug' => 'own-'.uniqid(),
            'sort_order' => 1,
            'depth' => 0,
            'is_active' => true,
        ]);
    }

    /** Зеркало — категория, на которую указывает направление. */
    private function зеркало(string $name, bool $видимое = true): CommunityCategory
    {
        $mirror = CommunityCategory::query()->create([
            'name' => $name,
            'slug' => 'mirror-'.uniqid(),
            'sort_order' => 1,
            'depth' => 0,
            'is_active' => true,
        ]);

        PostCategory::query()->create([
            'name' => $name,
            'slug' => 'dir-'.uniqid(),
            'sort_order' => 1,
            'depth' => 0,
            'is_active' => true,
            'in_communities' => $видимое,
            'community_category_id' => $mirror->id,
        ]);

        return $mirror;
    }

    private function имена(): array
    {
        CatalogService::flushCache();

        $плоско = [];
        $обход = function (array $узлы) use (&$обход, &$плоско): void {
            foreach ($узлы as $узел) {
                $плоско[] = $узел['name'];
                $обход($узел['children'] ?? []);
            }
        };
        $обход(app(CatalogService::class)->communityCategoryTree());

        return $плоско;
    }

    public function test_справочник_отдаёт_свою_ось_а_не_зеркала(): void
    {
        $своя = $this->своя('По масштабу');
        $зеркало = $this->зеркало('Авиация');

        $имена = $this->имена();

        $this->assertContains('По масштабу', $имена, 'своя категория обязана быть в справочнике');
        $this->assertNotContains(
            'Авиация',
            $имена,
            'зеркало направления в справочнике категорий сообществ быть не должно: '
            .'выбирать станут из одной оси, а размечать другой',
        );
        $this->assertNotEmpty($своя->id.$зеркало->id);
    }

    /**
     * Скрытое зеркало тоже не должно попадать.
     *
     * Первая редакция правки исключала только видимые зеркала, и скрытое
     * просочилось бы обратно, снова смешав оси.
     */
    public function test_скрытое_зеркало_тоже_не_попадает(): void
    {
        $this->своя('По тематике');
        $this->зеркало('Корабли', видимое: false);

        $имена = $this->имена();

        $this->assertContains('По тематике', $имена);
        $this->assertNotContains('Корабли', $имена, 'скрытое зеркало исключается наравне с видимым');
    }

    /**
     * Главная связь: категория каждого сообщества есть в справочнике.
     *
     * Именно её отсутствие и означало, что фильтр не найдёт ничего.
     */
    public function test_категория_каждого_сообщества_есть_в_справочнике(): void
    {
        $owner = User::factory()->create();
        $масштаб = $this->своя('По масштабу');
        $тематика = $this->своя('По тематике');
        $this->зеркало('Авиация');

        foreach ([$масштаб, $тематика] as $i => $категория) {
            Community::query()->create([
                'name' => "Сообщество {$i}",
                'slug' => 'soobshestvo-'.uniqid(),
                'description' => 'Описание',
                'category_id' => $категория->id,
                'created_by' => $owner->id,
                'status' => 'active',
            ]);
        }

        $имена = $this->имена();
        $нет = [];

        foreach (Community::query()->with('category')->get() as $сообщество) {
            $имя = $сообщество->category?->name;
            if ($имя !== null && ! in_array($имя, $имена, true)) {
                $нет[] = $сообщество->name.' → '.$имя;
            }
        }

        $this->assertSame(
            [],
            $нет,
            "Категории сообществ, которых нет в справочнике:\n  ".implode("\n  ", $нет)
            ."\nЗначит фильтр по категории их не найдёт.",
        );
    }
}

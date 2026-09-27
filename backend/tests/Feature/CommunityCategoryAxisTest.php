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
 * Замысел — единый источник: дерево направлений зеркалится в категории
 * сообществ, и справочник показывает зеркала (`CategorySingleSourceTest`).
 * Но в `community_categories` есть наследие, появившееся раньше
 * зеркалирования: «По масштабу» с 1/72 и 1/35, «По тематике» с Исторической
 * и Sci-Fi, «Региональные клубы». Им размечены все 18 сообществ на проде, а
 * в справочник они не попадали.
 *
 * Приёмка 27.09 замерила последствие: пересечение пусто, ноль из
 * восемнадцати, и фильтр по категории не находит ничего.
 *
 * Правило теперь такое: зеркала **плюс** наследные категории, которые
 * используются. Брошенные дубли от прошлых переносов не воскресают.
 */
class CommunityCategoryAxisTest extends TestCase
{
    use RefreshDatabase;

    private function категория(string $name): CommunityCategory
    {
        return CommunityCategory::query()->create([
            'name' => $name,
            'slug' => 'cat-'.uniqid(),
            'sort_order' => 1,
            'depth' => 0,
            'is_active' => true,
        ]);
    }

    /** Зеркало — категория, на которую указывает видимое направление. */
    private function зеркало(string $name): CommunityCategory
    {
        $mirror = $this->категория($name);

        PostCategory::query()->create([
            'name' => $name,
            'slug' => 'dir-'.uniqid(),
            'sort_order' => 1,
            'depth' => 0,
            'is_active' => true,
            'in_communities' => true,
            'community_category_id' => $mirror->id,
        ]);

        return $mirror;
    }

    private function сообщество(CommunityCategory $категория, string $имя): Community
    {
        return Community::query()->create([
            'name' => $имя,
            'slug' => 'soobshestvo-'.uniqid(),
            'description' => 'Описание',
            'category_id' => $категория->id,
            'created_by' => User::factory()->create()->id,
            'status' => 'active',
        ]);
    }

    /** @return list<string> */
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

    /**
     * Главная связь: категория каждого сообщества есть в справочнике.
     *
     * Именно её отсутствие означало, что фильтр не найдёт ничего. Проверяется
     * связь, а не список имён: список пришлось бы обновлять руками.
     */
    public function test_категория_каждого_сообщества_есть_в_справочнике(): void
    {
        $масштаб = $this->категория('По масштабу');
        $тематика = $this->категория('По тематике');
        $this->зеркало('Авиация');

        $this->сообщество($масштаб, 'Клуб масштабников');
        $this->сообщество($тематика, 'Историческая техника');

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

    public function test_зеркало_направления_остаётся_в_справочнике(): void
    {
        $this->зеркало('Авиация');

        $this->assertContains(
            'Авиация',
            $this->имена(),
            'зеркала — основной замысел справочника, их убирать нельзя',
        );
    }

    /**
     * Брошенный дубль не воскресает.
     *
     * После переносов в `community_categories` остаются категории, которые
     * никто не выбрал и на которые не указывает ни одно направление. В
     * справочнике им делать нечего: человек выберет то, чего в продукте нет.
     */
    public function test_наследная_категория_без_сообществ_не_показывается(): void
    {
        $брошенная = $this->категория('Планеры (старое)');
        $используемая = $this->категория('По масштабу');
        $this->сообщество($используемая, 'Клуб масштабников');

        $имена = $this->имена();

        $this->assertContains('По масштабу', $имена, 'используемая наследная категория обязана быть');
        $this->assertNotContains(
            'Планеры (старое)',
            $имена,
            'брошенный дубль предлагать незачем: его никто не выбрал',
        );
        $this->assertNotNull($брошенная->id);
    }
}

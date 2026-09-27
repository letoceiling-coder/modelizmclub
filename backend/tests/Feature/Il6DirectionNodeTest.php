<?php

namespace Tests\Feature;

use App\Enums\ContentStatus;
use App\Enums\UserStatus;
use App\Models\ListingCategory;
use App\Models\Post;
use App\Models\PostCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Modules\Catalog\Services\CategoryTaxonomyService;
use Tests\TestCase;

/**
 * Узел «ил 6» назван «Ил-6», и его записи никуда не делись.
 *
 * Приёмка 27.09: цепочка Авиация → Планеры → «ил 6» — единственная, чей
 * последний узел назван строчными буквами и с пробелом вместо дефиса;
 * соседи по уровню — «Автопилоты», «Эхолоты», «Краулеры».
 *
 * В задании стояло «убрать узел». Проверка внешних ключей показала, что
 * удаление унесло бы с собой записи узла (`posts.category_id` — cascade), а
 * комната чата этого уровня осталась бы без категории. Поэтому правится
 * имя, а сохранность содержимого проверяется здесь же — иначе «переименовал
 * вместо удаления» осталось бы заявлением.
 */
class Il6DirectionNodeTest extends TestCase
{
    use RefreshDatabase;

    private const МИГРАЦИЯ = 'database/migrations/2026_09_27_110000_rename_il6_direction_node.php';

    private function миграция(): object
    {
        return require base_path(self::МИГРАЦИЯ);
    }

    private function узел(string $name, string $slug, ?PostCategory $parent = null): PostCategory
    {
        $node = PostCategory::query()->create([
            'name' => $name,
            'slug' => $slug,
            'parent_id' => $parent?->id,
            'sort_order' => 1,
            'is_active' => true,
            'in_listings' => true,
            'in_communities' => true,
        ]);

        app(CategoryTaxonomyService::class)->syncFromPostCategory($node);

        return $node->fresh();
    }

    /** @return array{0: PostCategory, 1: Post} Узел «ил 6» и запись на нём. */
    private function цепочка(): array
    {
        $авиация = $this->узел('Авиация', 'aviaciya');
        $планеры = $this->узел('Планеры', 'planery', $авиация);
        $ил6 = $this->узел('ил 6', 'il-6', $планеры);

        $автор = User::factory()->create(['status' => UserStatus::Active]);
        $запись = Post::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $автор->id,
            'category_id' => $ил6->id,
            'title' => 'Сборка Ил-6',
            'body' => 'Текст записи.',
            'status' => ContentStatus::Published,
            'published_at' => now(),
        ]);

        return [$ил6, $запись];
    }

    public function test_имя_узла_исправлено(): void
    {
        [$ил6] = $this->цепочка();

        $this->миграция()->up();

        $this->assertSame('Ил-6', PostCategory::query()->whereKey($ил6->id)->value('name'));
        $this->assertSame(
            0,
            PostCategory::query()->where('name', 'ил 6')->count(),
            'старое имя не должно оставаться нигде в дереве',
        );
    }

    /**
     * Зеркала в каталоге объявлений следуют за именем.
     *
     * Имя лежит в трёх деревьях, и правка только `post_categories` оставила
     * бы «ил 6» в каталоге объявлений — там, где его и видно покупателю.
     */
    public function test_зеркало_в_каталоге_объявлений_переименовано_тоже(): void
    {
        [$ил6] = $this->цепочка();

        $зеркало = (int) $ил6->listing_category_id;
        $this->assertNotSame(0, $зеркало, 'подготовка теста: зеркало должно существовать');
        $this->assertSame('ил 6', ListingCategory::query()->whereKey($зеркало)->value('name'));

        $this->миграция()->up();

        $this->assertSame('Ил-6', ListingCategory::query()->whereKey($зеркало)->value('name'));
    }

    /**
     * Содержимое узла остаётся на месте.
     *
     * Ровно это и отличает переименование от удаления: у `posts.category_id`
     * внешний ключ стоит на cascade, и удаление строки узла унесло бы записи.
     */
    public function test_записи_узла_остаются_на_нём(): void
    {
        [$ил6, $запись] = $this->цепочка();

        $this->миграция()->up();

        $this->assertSame(
            (int) $ил6->id,
            (int) Post::query()->whereKey($запись->id)->value('category_id'),
            'запись обязана остаться на узле: удаление узла унесло бы её с собой',
        );
        $this->assertTrue(
            PostCategory::query()->whereKey($ил6->id)->exists(),
            'узел не удаляется — правится имя',
        );
    }

    public function test_откат_возвращает_прежнее_имя(): void
    {
        [$ил6] = $this->цепочка();

        $миграция = $this->миграция();
        $миграция->up();
        $миграция->down();

        $this->assertSame('ил 6', PostCategory::query()->whereKey($ил6->id)->value('name'));
    }

    /**
     * Узла нет — миграция молчит.
     *
     * Имя правится и из админки; к моменту выкатки его могли поправить
     * руками, и падать на этом миграция не должна.
     */
    public function test_без_узла_миграция_проходит_молча(): void
    {
        $this->узел('Авиация', 'aviaciya');

        $this->миграция()->up();

        $this->assertSame(0, PostCategory::query()->where('name', 'Ил-6')->count());
    }
}

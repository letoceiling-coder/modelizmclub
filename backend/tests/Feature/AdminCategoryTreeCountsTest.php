<?php

namespace Tests\Feature;

use App\Enums\ContentStatus;
use App\Enums\ListingStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Listing;
use App\Models\Post;
use App\Models\PostCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Modules\Catalog\Services\CatalogService;
use Modules\Catalog\Services\CategoryTaxonomyService;
use Tests\TestCase;

/**
 * Счётчики в узле дерева направлений (C2).
 *
 * Перенос и удаление узла делаются с числом перед глазами: сколько в нём
 * записей, сколько объявлений и есть ли у направления администратор.
 * Объявление может стоять и в подкатегории каталога — оно всё равно
 * считается тому узлу, в котором лежит.
 */
class AdminCategoryTreeCountsTest extends TestCase
{
    use RefreshDatabase;

    private function direction(string $name, string $slug, ?PostCategory $parent = null): PostCategory
    {
        $category = PostCategory::query()->create([
            'parent_id' => $parent?->id,
            'name' => $name,
            'slug' => $slug,
            'is_active' => true,
            'in_feed' => true,
            'in_listings' => true,
            'in_communities' => true,
        ]);
        app(CategoryTaxonomyService::class)->syncFromPostCategory($category);

        return $category->fresh();
    }

    private function person(UserRole $role = UserRole::User): User
    {
        return User::factory()->create([
            'role' => $role,
            'status' => UserStatus::Active,
            'email_verified_at' => now(),
            'phone_verified_at' => now(),
        ]);
    }

    private function запись(PostCategory $direction): Post
    {
        return Post::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $this->person()->id,
            'category_id' => $direction->id,
            'title' => 'Запись в '.$direction->name,
            'body' => 'Текст',
            'status' => ContentStatus::Published,
        ]);
    }

    private function listing(int $categoryId, ?int $subcategoryId = null): Listing
    {
        return Listing::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $this->person()->id,
            'category_id' => $categoryId,
            'subcategory_id' => $subcategoryId,
            'title' => 'Лот',
            'slug' => 'lot-'.Str::random(8),
            'description' => 'Описание',
            'price_cents' => 100000,
            'currency' => 'RUB',
            'status' => ListingStatus::Published,
        ]);
    }

    /** @return array<int, array<string, mixed>> */
    private function tree(User $actor): array
    {
        $response = $this->actingAs($actor)->getJson('/api/v1/admin/categories/post?per_page=100');
        $response->assertOk();

        $строки = [];
        foreach ($response->json('data.data') as $row) {
            $строки[$row['slug']] = $row;
        }

        return $строки;
    }

    public function test_узел_несёт_число_записей_объявлений_и_признак_администратора(): void
    {
        $авиация = $this->direction('Авиация', 'aviation');
        $броня = $this->direction('Бронетехника', 'armor');

        $this->запись($авиация);
        $this->запись($авиация);
        $this->запись($броня);

        $полкаАвиации = app(CategoryTaxonomyService::class)->listingIdsForPostCategory($авиация->id)[0];
        $this->listing($полкаАвиации);

        DB::table('category_admins')->insert([
            'user_id' => $this->person(UserRole::CategoryAdmin)->id,
            'post_category_id' => $авиация->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $дерево = $this->tree($this->person(UserRole::Moderator));

        $this->assertSame(2, $дерево['aviation']['posts_count']);
        $this->assertSame(1, $дерево['aviation']['listings_count']);
        $this->assertTrue($дерево['aviation']['has_admin']);

        // Соседнее направление своими числами не заражается.
        $this->assertSame(1, $дерево['armor']['posts_count']);
        $this->assertSame(0, $дерево['armor']['listings_count']);
        $this->assertFalse($дерево['armor']['has_admin']);
    }

    public function test_объявление_в_подкатегории_каталога_считается_своему_узлу(): void
    {
        $авиация = $this->direction('Авиация', 'aviation');
        $вторая = $this->direction('Вторая мировая', 'aviation-wwii', $авиация);

        $taxonomy = app(CategoryTaxonomyService::class);
        $полкаАвиации = $taxonomy->listingIdsForPostCategory($авиация->id)[0];
        $полкаВторой = $taxonomy->listingIdsForPostCategory($вторая->id)[0];

        // Лот лежит в подкатегории: category_id — родитель, subcategory_id — лист.
        $this->listing($полкаАвиации, $полкаВторой);

        $дерево = $this->tree($this->person(UserRole::Moderator));

        $this->assertSame(1, $дерево['aviation-wwii']['listings_count']);
        $this->assertSame(0, $дерево['aviation']['listings_count']);
    }

    public function test_удалённое_объявление_не_считается(): void
    {
        $авиация = $this->direction('Авиация', 'aviation');
        $полка = app(CategoryTaxonomyService::class)->listingIdsForPostCategory($авиация->id)[0];

        $this->listing($полка);
        $this->listing($полка)->delete();

        $дерево = $this->tree($this->person(UserRole::Moderator));

        $this->assertSame(1, $дерево['aviation']['listings_count']);
    }

    public function test_ответ_на_сохранение_несёт_те_же_счётчики_что_и_список(): void
    {
        $авиация = $this->direction('Авиация', 'aviation');
        $вторая = $this->direction('Вторая мировая', 'aviation-wwii', $авиация);

        $taxonomy = app(CategoryTaxonomyService::class);
        $this->listing(
            $taxonomy->listingIdsForPostCategory($авиация->id)[0],
            $taxonomy->listingIdsForPostCategory($вторая->id)[0],
        );
        $this->запись($вторая);

        DB::table('category_admins')->insert([
            'user_id' => $this->person(UserRole::CategoryAdmin)->id,
            'post_category_id' => $вторая->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $moderator = $this->person(UserRole::Moderator);
        $response = $this->actingAs($moderator)->patchJson(
            '/api/v1/admin/categories/post/'.$вторая->id,
            [
                'name' => $вторая->name,
                'slug' => $вторая->slug,
                'parent_id' => $авиация->id,
                'sort_order' => 3,
                'is_active' => true,
            ],
        );
        $response->assertOk();

        // Иначе числа пропадали бы с экрана до перезагрузки страницы.
        $this->assertSame(1, $response->json('data.posts_count'));
        $this->assertSame(1, $response->json('data.listings_count'));
        $this->assertTrue($response->json('data.has_admin'));

        $дерево = $this->tree($moderator);
        $this->assertSame(
            [$дерево['aviation-wwii']['posts_count'], $дерево['aviation-wwii']['listings_count']],
            [$response->json('data.posts_count'), $response->json('data.listings_count')],
        );
    }

    public function test_порядок_ряда_сохраняется_одним_запросом(): void
    {
        $первое = $this->direction('Авиация', 'aviation');
        $второе = $this->direction('Бронетехника', 'armor');
        $третье = $this->direction('Флот', 'fleet');

        $moderator = $this->person(UserRole::Moderator);
        $response = $this->actingAs($moderator)->patchJson('/api/v1/admin/categories/post/reorder', [
            'ids' => [$третье->id, $первое->id, $второе->id],
        ]);
        $response->assertOk();

        $порядок = PostCategory::query()
            ->whereNull('parent_id')
            ->orderBy('sort_order')
            ->pluck('slug')
            ->all();
        $this->assertSame(['fleet', 'aviation', 'armor'], $порядок);

        // Одно действие человека — одна строка аудита, а не три.
        $this->assertSame(1, DB::table('audit_logs')->where('action', 'admin.categories.post.reorder')->count());
    }

    public function test_обрезанный_ряд_отклоняется(): void
    {
        $первое = $this->direction('Авиация', 'aviation');
        $второе = $this->direction('Бронетехника', 'armor');
        $this->direction('Флот', 'fleet');

        // Третьего соседа клиент не прислал: значит он его не видит, и
        // перенумерация расставила бы ему чужой номер.
        $this->actingAs($this->person(UserRole::Moderator))
            ->patchJson('/api/v1/admin/categories/post/reorder', [
                'ids' => [$второе->id, $первое->id],
            ])
            ->assertStatus(422);

        $this->assertSame(
            ['aviation', 'armor', 'fleet'],
            PostCategory::query()->whereNull('parent_id')->orderBy('sort_order')->orderBy('name')->pluck('slug')->all(),
        );
    }

    public function test_узлы_из_разных_рядов_не_переставляются(): void
    {
        $авиация = $this->direction('Авиация', 'aviation');
        $вторая = $this->direction('Вторая мировая', 'aviation-wwii', $авиация);

        $this->actingAs($this->person(UserRole::Moderator))
            ->patchJson('/api/v1/admin/categories/post/reorder', [
                'ids' => [$вторая->id, $авиация->id],
            ])
            ->assertStatus(422);
    }

    public function test_новый_порядок_доезжает_до_каталога_и_сообществ(): void
    {
        $первое = $this->direction('Авиация', 'aviation');
        $второе = $this->direction('Бронетехника', 'armor');
        $третье = $this->direction('Флот', 'fleet');

        $this->actingAs($this->person(UserRole::Moderator))
            ->patchJson('/api/v1/admin/categories/post/reorder', [
                'ids' => [$третье->id, $первое->id, $второе->id],
            ])
            ->assertOk();

        // У зеркал свой sort_order, и публичные деревья сортируются по нему.
        // Запиши мы только направление — каталог остался бы со старым порядком.
        $ожидаем = ['fleet', 'aviation', 'armor'];

        $каталог = app(CatalogService::class)->listingCategoryTree();
        $this->assertSame($ожидаем, array_column($каталог, 'slug'));

        $сообщества = app(CatalogService::class)->communityCategoryTree();
        $this->assertSame($ожидаем, array_column($сообщества, 'slug'));
    }
}

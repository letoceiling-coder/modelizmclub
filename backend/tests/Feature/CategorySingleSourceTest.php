<?php

namespace Tests\Feature;

use App\Enums\CommunityStatus;
use App\Enums\UserRole;
use App\Models\Community;
use App\Models\CommunityCategory;
use App\Models\ListingCategory;
use App\Models\PostCategory;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Str;
use Modules\Catalog\Services\CatalogService;
use Tests\TestCase;

/**
 * Одно дерево категорий: направления — источник, деревья объявлений и
 * сообществ строятся из него по флагам. Данные прода 17.09 в миниатюре.
 */
class CategorySingleSourceTest extends TestCase
{
    use RefreshDatabase;

    private function node(string $class, string $name, string $slug, ?Model $parent = null, int $sort = 0): Model
    {
        return $class::query()->create([
            'parent_id' => $parent?->id,
            'name' => $name,
            'slug' => $slug,
            'sort_order' => $sort,
            'is_active' => true,
            'depth' => $parent ? $parent->depth + 1 : 0,
            'path' => $parent ? $parent->path.'/'.$slug : $slug,
        ]);
    }

    private function seedTrees(): void
    {
        $user = User::factory()->create();

        // Направления
        $aviation = $this->node(PostCategory::class, 'Авиация', 'aviation', null, 1);
        $this->node(PostCategory::class, 'Планеры', 'aviation-gliders', $aviation, 1);
        $this->node(PostCategory::class, 'Каналы', 'channels', null, 2);
        $this->node(PostCategory::class, 'Выставки и события', 'events', null, 3);
        $this->node(PostCategory::class, 'Kotello', 'kotello', null, 4);

        // Объявления: те же пути + торговый раздел
        $lAviation = $this->node(ListingCategory::class, 'Авиация', 'aviation', null, 1);
        $this->node(ListingCategory::class, 'Планеры', 'aviation-gliders', $lAviation, 1);
        $this->node(ListingCategory::class, 'Выставки и события', 'events', null, 3);
        $kits = $this->node(ListingCategory::class, 'Наборы', 'kits', null, 5);
        $this->node(ListingCategory::class, 'Б/у', 'kits-used', $kits, 1);

        // Сообщества: общий путь, своя группировка и брошенный корневой дубль
        $this->node(CommunityCategory::class, 'Авиация', 'aviation', null, 1);
        $scale = $this->node(CommunityCategory::class, 'По масштабу', 'by-scale', null, 6);
        $s35 = $this->node(CommunityCategory::class, '1/35', 'scale-35', $scale, 1);
        $this->node(CommunityCategory::class, 'Планеры', 'gliders-old', null, 7);

        Community::query()->create([
            'category_id' => $s35->id,
            'name' => 'Клуб 1/35',
            'slug' => 'club-35-'.Str::random(5),
            'status' => CommunityStatus::Active,
            'approved_at' => now(),
            'created_by' => $user->id,
            'access_type' => 'open',
            'members_count' => 1,
        ]);
        CatalogService::flushCache();
    }

    /** @return list<string> */
    private function rootNames(string $endpoint): array
    {
        CatalogService::flushCache();

        return collect($this->getJson($endpoint)->assertOk()->json('data'))->pluck('name')->all();
    }

    public function test_dry_run_changes_nothing(): void
    {
        $this->seedTrees();
        $before = PostCategory::query()->orderBy('id')->get()->toArray();

        Artisan::call('categories:single-source');

        $this->assertSame($before, PostCategory::query()->orderBy('id')->get()->toArray());
        $this->assertSame(3, ListingCategory::query()->whereNull('parent_id')->count());
    }

    public function test_apply_makes_one_source_and_trees_follow_flags(): void
    {
        $this->seedTrees();

        Artisan::call('categories:single-source', ['--apply' => true]);

        $aviation = PostCategory::query()->where('slug', 'aviation')->first();
        $this->assertSame(ListingCategory::query()->where('slug', 'aviation')->value('id'), $aviation->listing_category_id);
        $this->assertSame(CommunityCategory::query()->where('slug', 'aviation')->value('id'), $aviation->community_category_id);

        $kits = PostCategory::query()->where('slug', 'kits')->first();
        $this->assertNotNull($kits);
        $this->assertFalse($kits->in_feed);
        $this->assertTrue($kits->in_listings);
        $this->assertFalse($kits->in_communities);
        $this->assertSame('kits/kits-used', PostCategory::query()->where('slug', 'kits-used')->value('path'));

        $this->assertTrue(PostCategory::query()->where('slug', 'by-scale')->where('in_communities', true)->where('in_feed', false)->exists());
        $this->assertTrue(PostCategory::query()->where('slug', 'scale-35')->exists());
        $this->assertFalse(PostCategory::query()->where('slug', 'gliders-old')->exists(), 'брошенный дубль не переносится');
        $this->assertTrue(CommunityCategory::query()->where('slug', 'gliders-old')->exists(), 'и не удаляется');

        $this->assertFalse(PostCategory::query()->where('slug', 'channels')->value('in_listings'));
        $this->assertFalse(PostCategory::query()->where('slug', 'events')->value('in_listings'));

        // Kotello был только направлением — теперь у него есть полка в каталоге.
        $this->assertNotNull(PostCategory::query()->where('slug', 'kotello')->value('listing_category_id'));

        $this->assertSame(['Авиация', 'Kotello', 'Наборы'], $this->rootNames('/api/v1/categories/listings'));
        $this->assertSame(['Авиация', 'Каналы', 'Выставки и события', 'Kotello'], $this->rootNames('/api/v1/categories/posts'));
        $this->assertSame(['Авиация', 'Выставки и события', 'Kotello', 'По масштабу'], $this->rootNames('/api/v1/categories/communities'));
    }

    public function test_apply_is_idempotent(): void
    {
        $this->seedTrees();
        Artisan::call('categories:single-source', ['--apply' => true]);
        $snapshot = [PostCategory::query()->count(), ListingCategory::query()->count(), CommunityCategory::query()->count()];
        $links = PostCategory::query()->orderBy('id')->pluck('listing_category_id', 'id')->all();

        Artisan::call('categories:single-source', ['--apply' => true]);

        $this->assertSame($snapshot, [PostCategory::query()->count(), ListingCategory::query()->count(), CommunityCategory::query()->count()]);
        $this->assertSame($links, PostCategory::query()->orderBy('id')->pluck('listing_category_id', 'id')->all());
    }

    public function test_admin_edits_only_the_direction_tree(): void
    {
        $this->seedTrees();
        Artisan::call('categories:single-source', ['--apply' => true]);
        $admin = User::factory()->create(['role' => UserRole::Owner]);
        $headers = ['Authorization' => 'Bearer '.$admin->createToken('api')->plainTextToken];
        $listingId = ListingCategory::query()->where('slug', 'kits')->value('id');

        $this->patchJson("/api/v1/admin/categories/listing/{$listingId}", ['name' => 'X', 'slug' => 'x'], $headers)->assertStatus(422);
        $this->postJson('/api/v1/admin/categories/listing', ['name' => 'X', 'slug' => 'x'], $headers)->assertStatus(422);
        $this->deleteJson("/api/v1/admin/categories/community/{$listingId}", [], $headers)->assertStatus(422);

        // Направление без объявлений — полка в каталоге не заводится.
        $created = $this->postJson('/api/v1/admin/categories/post', [
            'name' => 'Встречи', 'slug' => 'meetups', 'is_active' => true, 'in_listings' => false,
        ], $headers)->assertCreated()->json('data');
        $this->assertNull(PostCategory::query()->find($created['id'])->listing_category_id);
        $this->assertFalse(ListingCategory::query()->where('slug', 'meetups')->exists());

        // Цена размещения правится в строке направления и ложится в узел каталога.
        $kits = PostCategory::query()->where('slug', 'kits')->first();
        $this->patchJson("/api/v1/admin/categories/post/{$kits->id}", [
            'name' => 'Наборы', 'slug' => 'kits', 'is_active' => true, 'listing_price_cents' => 5000, 'subscriber_listing_price_cents' => 2000,
        ], $headers)->assertOk()->assertJsonPath('data.listing_price_cents', 5000);
        $this->assertSame(5000, (int) ListingCategory::query()->whereKey($listingId)->value('listing_price_cents'));

        // Правка без цен (переименование) цену в каталоге не трогает.
        $this->patchJson("/api/v1/admin/categories/post/{$kits->id}", [
            'name' => 'Наборы моделей', 'slug' => 'kits', 'is_active' => true,
        ], $headers)->assertOk()->assertJsonPath('data.listing_price_cents', 5000)->assertJsonPath('data.name', 'Наборы моделей');
        $this->assertSame('Наборы моделей', ListingCategory::query()->whereKey($listingId)->value('name'));

        $row = collect($this->getJson('/api/v1/admin/categories/post?per_page=200', $headers)->assertOk()->json('data.data'))->firstWhere('slug', 'kits');
        $this->assertSame(5000, $row['listing_price_cents']);
        $this->assertFalse($row['in_feed']);
        $this->assertTrue($row['in_listings']);
    }
}

<?php

namespace Tests\Feature;

use App\Enums\CommunityStatus;
use App\Enums\ContentStatus;
use App\Enums\ListingStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Channel;
use App\Models\Community;
use App\Models\CommunityCategory;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\Post;
use App\Models\PostCategory;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Modules\Catalog\Services\CategoryTaxonomyService;
use Tests\TestCase;

class CategoryTaxonomyTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    public function test_admin_can_create_three_level_tree_and_mirrors_listing_community(): void
    {
        $admin = User::factory()->create(['role' => UserRole::Admin]);
        $headers = ['Authorization' => 'Bearer '.$admin->createToken('api')->plainTextToken];
        $suffix = uniqid();

        $root = $this->postJson('/api/v1/admin/categories/post', [
            'name' => 'Авиация',
            'slug' => 'aviation-'.$suffix,
            'sort_order' => 1,
            'is_active' => true,
        ], $headers)->assertCreated()->json('data');

        $mid = $this->postJson('/api/v1/admin/categories/post', [
            'name' => 'Стендовые модели',
            'slug' => 'scale-'.$suffix,
            'parent_id' => $root['id'],
            'sort_order' => 1,
            'is_active' => true,
        ], $headers)->assertCreated()->json('data');

        $leaf = $this->postJson('/api/v1/admin/categories/post', [
            'name' => 'Масштаб 1:72',
            'slug' => '72-'.$suffix,
            'parent_id' => $mid['id'],
            'sort_order' => 1,
            'is_active' => true,
        ], $headers)->assertCreated()->json('data');

        $this->assertSame(0, $root['depth'] ?? PostCategory::query()->find($root['id'])->depth);
        $this->assertSame(1, PostCategory::query()->find($mid['id'])->depth);
        $this->assertSame(2, PostCategory::query()->find($leaf['id'])->depth);

        $this->postJson('/api/v1/admin/categories/post', [
            'name' => 'Слишком глубоко',
            'slug' => 'too-deep-'.$suffix,
            'parent_id' => $leaf['id'],
            'is_active' => true,
        ], $headers)->assertStatus(422);

        $this->assertDatabaseHas('listing_categories', ['slug' => 'aviation-'.$suffix, 'depth' => 0]);
        $this->assertDatabaseHas('listing_categories', ['slug' => 'scale-'.$suffix, 'depth' => 1]);
        $this->assertDatabaseHas('listing_categories', ['slug' => '72-'.$suffix, 'depth' => 2]);
        $this->assertDatabaseHas('community_categories', ['slug' => 'aviation-'.$suffix, 'depth' => 0]);
        $this->assertDatabaseHas('community_categories', ['slug' => '72-'.$suffix, 'depth' => 2]);

        $tree = $this->getJson('/api/v1/categories/posts')->assertOk()->json('data');
        $this->assertSame('aviation-'.$suffix, $tree[0]['slug']);
        $this->assertSame('scale-'.$suffix, $tree[0]['children'][0]['slug']);
        $this->assertSame('72-'.$suffix, $tree[0]['children'][0]['children'][0]['slug']);
        $this->assertArrayHasKey('usage_count', $tree[0]);
    }

    public function test_taxonomy_filters_listings_communities_feed_and_channels(): void
    {
        $taxonomy = app(CategoryTaxonomyService::class);
        $user = User::factory()->create(['status' => UserStatus::Active]);
        $suffix = uniqid();

        $root = PostCategory::query()->create([
            'name' => 'Корабли',
            'slug' => 'ships-'.$suffix,
            'sort_order' => 1,
            'is_active' => true,
        ]);
        $taxonomy->syncFromPostCategory($root);

        $leaf = PostCategory::query()->create([
            'parent_id' => $root->id,
            'name' => 'Парусники',
            'slug' => 'sail-'.$suffix,
            'sort_order' => 1,
            'is_active' => true,
        ]);
        $taxonomy->syncFromPostCategory($leaf);

        $listingLeaf = ListingCategory::query()->where('slug', 'sail-'.$suffix)->firstOrFail();
        $otherListing = ListingCategory::query()->create([
            'name' => 'Другое',
            'slug' => 'other-'.$suffix,
            'sort_order' => 9,
            'depth' => 0,
            'is_active' => true,
        ]);

        Listing::query()->create([
            'user_id' => $user->id,
            'category_id' => $listingLeaf->id,
            'title' => 'Модель парусника',
            'slug' => 'sail-model-'.$suffix,
            'description' => 'Описание',
            'price_cents' => 10000,
            'status' => ListingStatus::Published,
            'published_at' => now(),
        ]);
        Listing::query()->create([
            'user_id' => $user->id,
            'category_id' => $otherListing->id,
            'title' => 'Другая модель',
            'slug' => 'other-model-'.$suffix,
            'description' => 'Описание',
            'price_cents' => 20000,
            'status' => ListingStatus::Published,
            'published_at' => now(),
        ]);

        $this->getJson('/api/v1/listings?taxonomy_id='.$root->id)
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.title', 'Модель парусника');

        $communityCat = CommunityCategory::query()->where('slug', 'sail-'.$suffix)->firstOrFail();
        $otherCommunityCat = CommunityCategory::query()->create([
            'name' => 'Прочее',
            'slug' => 'misc-'.$suffix,
            'sort_order' => 9,
            'depth' => 0,
            'is_active' => true,
        ]);
        Community::query()->create([
            'category_id' => $communityCat->id,
            'name' => 'Клуб парусников',
            'slug' => 'sail-club-'.$suffix,
            'status' => CommunityStatus::Active,
            'approved_at' => now(),
        ]);
        Community::query()->create([
            'category_id' => $otherCommunityCat->id,
            'name' => 'Другой клуб',
            'slug' => 'other-club-'.$suffix,
            'status' => CommunityStatus::Active,
            'approved_at' => now(),
        ]);

        $this->getJson('/api/v1/communities?taxonomy_id='.$root->id)
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Клуб парусников');

        Post::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $user->id,
            'category_id' => $leaf->id,
            'title' => 'Пост про парус',
            'body' => 'Текст',
            'status' => ContentStatus::Published,
            'published_at' => now(),
        ]);
        $otherPostCat = PostCategory::query()->create([
            'name' => 'Авто',
            'slug' => 'auto-'.$suffix,
            'sort_order' => 8,
            'is_active' => true,
        ]);
        Post::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $user->id,
            'category_id' => $otherPostCat->id,
            'title' => 'Пост про авто',
            'body' => 'Текст',
            'status' => ContentStatus::Published,
            'published_at' => now(),
        ]);

        $feed = $this->getJson('/api/v1/feed?filter=category&category_id='.$root->id)
            ->assertOk()
            ->json('data');
        $titles = collect($feed)->pluck('title')->all();
        $this->assertContains('Пост про парус', $titles);
        $this->assertNotContains('Пост про авто', $titles);

        Channel::query()->create([
            'owner_id' => $user->id,
            'name' => 'Парусный канал',
            'slug' => 'sail-channel-'.$suffix,
            'kind' => 'author',
            'category' => 'Парусники',
            'is_active' => true,
        ]);
        Channel::query()->create([
            'owner_id' => $user->id,
            'name' => 'Автоканал',
            'slug' => 'auto-channel-'.$suffix,
            'kind' => 'author',
            'category' => 'Авто',
            'is_active' => true,
        ]);

        $this->getJson('/api/v1/channels?taxonomy_id='.$leaf->id)
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.slug', 'sail-channel-'.$suffix);
    }

    public function test_cannot_nest_category_under_its_descendant(): void
    {
        $taxonomy = app(CategoryTaxonomyService::class);
        $root = PostCategory::query()->create([
            'name' => 'Root',
            'slug' => 'cycle-root-'.uniqid(),
            'is_active' => true,
        ]);
        $taxonomy->syncFromPostCategory($root);
        $child = PostCategory::query()->create([
            'parent_id' => $root->id,
            'name' => 'Child',
            'slug' => 'cycle-child-'.uniqid(),
            'is_active' => true,
        ]);
        $taxonomy->syncFromPostCategory($child);

        $root->parent_id = $child->id;
        $this->expectException(ValidationException::class);
        $taxonomy->applyHierarchy($root);
    }

    public function test_listing_pair_maps_post_leaf_to_listing_ids_and_syncs_missing_mirror(): void
    {
        $taxonomy = app(CategoryTaxonomyService::class);
        $suffix = uniqid();

        $root = PostCategory::query()->create([
            'name' => 'Авиация',
            'slug' => 'aviation-'.$suffix,
            'sort_order' => 1,
            'is_active' => true,
        ]);
        $leaf = PostCategory::query()->create([
            'parent_id' => $root->id,
            'name' => 'ДВС',
            'slug' => 'ice-'.$suffix,
            'sort_order' => 1,
            'is_active' => true,
        ]);

        $this->assertDatabaseMissing('listing_categories', ['slug' => 'ice-'.$suffix]);

        $pair = $taxonomy->listingPairForPostCategory((int) $leaf->id);

        $listingRoot = ListingCategory::query()->where('slug', 'aviation-'.$suffix)->firstOrFail();
        $listingLeaf = ListingCategory::query()->where('slug', 'ice-'.$suffix)->firstOrFail();

        $this->assertSame((int) $listingRoot->id, $pair['category_id']);
        $this->assertSame((int) $listingLeaf->id, $pair['subcategory_id']);
        $this->assertNotSame((int) $root->id, $pair['category_id']);
        $this->assertNotSame((int) $leaf->id, $pair['subcategory_id']);
    }

    public function test_create_listing_accepts_post_taxonomy_id_when_listing_ids_differ(): void
    {
        $taxonomy = app(CategoryTaxonomyService::class);
        $suffix = uniqid();
        $user = User::factory()->create();

        $root = PostCategory::query()->create([
            'name' => 'Авиация',
            'slug' => 'aviation-'.$suffix,
            'sort_order' => 1,
            'is_active' => true,
        ]);
        $leaf = PostCategory::query()->create([
            'parent_id' => $root->id,
            'name' => 'ДВС',
            'slug' => 'ice-'.$suffix,
            'sort_order' => 1,
            'is_active' => true,
        ]);
        $taxonomy->syncFromPostCategory($root);
        $taxonomy->syncFromPostCategory($leaf);

        $listingLeaf = ListingCategory::query()->where('slug', 'ice-'.$suffix)->firstOrFail();
        $this->assertNotSame((int) $leaf->id, (int) $listingLeaf->id);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/listings', [
                'title' => 'Тестовое объявление ДВС',
                'description' => str_repeat('Описание объявления. ', 5),
                'taxonomy_id' => $leaf->id,
                'price_cents' => 100_000,
                'publish' => false,
            ])
            ->assertCreated()
            ->assertJsonPath('data.category.id', $listingLeaf->parent_id)
            ->assertJsonPath('data.subcategory.id', $listingLeaf->id);
    }
}

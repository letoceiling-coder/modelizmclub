<?php

namespace Tests\Feature;

use App\Enums\CommunityStatus;
use App\Enums\ContentStatus;
use App\Enums\ListingStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Channel;
use App\Models\ChannelPost;
use App\Models\Community;
use App\Models\CommunityCategory;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\ModerationQueue;
use App\Models\Post;
use App\Models\PostCategory;
use App\Models\SystemSetting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Modules\Admin\Services\CategoryAdminService;
use Modules\Catalog\Services\CategoryTaxonomyService;
use Tests\TestCase;

/**
 * Администратор направления (решение 19.09): модерирует, правит и снимает
 * записи и объявления только своих направлений вместе с подкатегориями.
 * Чужое не видит ни в списках, ни по прямой ссылке. Жалобы, удаление и
 * остальные разделы — модератору и Владельцу.
 */
class CategoryAdminTest extends TestCase
{
    use RefreshDatabase;

    private PostCategory $aviation;

    private PostCategory $wwii;

    private PostCategory $armor;

    protected function setUp(): void
    {
        parent::setUp();
        $this->aviation = $this->direction('Авиация', 'aviation');
        $this->wwii = $this->direction('Вторая мировая', 'aviation-wwii', $this->aviation);
        $this->armor = $this->direction('Бронетехника', 'armor');
    }

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

    private function categoryAdmin(PostCategory ...$categories): User
    {
        $admin = $this->person(UserRole::CategoryAdmin);
        foreach ($categories as $category) {
            DB::table('category_admins')->insert([
                'user_id' => $admin->id,
                'post_category_id' => $category->id,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        return $admin;
    }

    private function pendingPost(PostCategory $category): Post
    {
        $post = Post::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $this->person()->id,
            'category_id' => $category->id,
            'title' => 'Запись в '.$category->name,
            'body' => 'Текст',
            'status' => ContentStatus::PendingModeration,
        ]);
        ModerationQueue::query()->create([
            'moderatable_type' => Post::class,
            'moderatable_id' => $post->id,
            'queue' => 'posts',
            'priority' => 0,
            'status' => 'pending',
        ]);

        return $post;
    }

    private function pendingListing(PostCategory $direction): Listing
    {
        $listingCategoryId = app(CategoryTaxonomyService::class)->listingIdsForPostCategory($direction->id)[0];
        $listing = Listing::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $this->person()->id,
            'category_id' => $listingCategoryId,
            'title' => 'Лот в '.$direction->name,
            'slug' => 'lot-'.uniqid(),
            'description' => 'Описание',
            'price_cents' => 100000,
            'currency' => 'RUB',
            'status' => ListingStatus::PendingModeration,
        ]);
        ModerationQueue::query()->create([
            'moderatable_type' => Listing::class,
            'moderatable_id' => $listing->id,
            'queue' => 'listings',
            'priority' => 0,
            'status' => 'pending',
        ]);

        return $listing;
    }

    private function pendingCommunity(): Community
    {
        $community = Community::query()->create([
            'category_id' => CommunityCategory::query()->firstOrFail()->id,
            'name' => 'Клуб '.Str::random(5),
            'slug' => 'club-'.Str::random(8),
            'status' => CommunityStatus::Pending,
            'created_by' => $this->person()->id,
            'access_type' => 'open',
            'members_count' => 1,
        ]);
        ModerationQueue::query()->create([
            'moderatable_type' => Community::class,
            'moderatable_id' => $community->id,
            'queue' => 'communities',
            'priority' => 0,
            'status' => 'pending',
        ]);

        return $community;
    }

    public function test_queue_shows_only_own_directions_with_subcategories(): void
    {
        $own = $this->pendingPost($this->aviation);
        $child = $this->pendingPost($this->wwii);
        $foreign = $this->pendingPost($this->armor);
        $ownListing = $this->pendingListing($this->aviation);
        $foreignListing = $this->pendingListing($this->armor);
        $this->pendingCommunity();

        $admin = $this->categoryAdmin($this->aviation);
        $ids = collect($this->actingAs($admin, 'sanctum')->getJson('/api/v1/admin/moderation/queue?per_page=50')->assertOk()->json('data'))
            ->map(fn ($row) => $row['moderatable_type'].'#'.$row['moderatable_id'])
            ->sort()->values()->all();

        $expected = collect(['Post#'.$own->id, 'Post#'.$child->id, 'Listing#'.$ownListing->id])->sort()->values()->all();
        $this->assertSame($expected, $ids);
        $this->assertNotContains('Post#'.$foreign->id, $ids);
        $this->assertNotContains('Listing#'.$foreignListing->id, $ids);

        // Модератор видит всё — шесть строк.
        $this->assertCount(6, $this->actingAs($this->person(UserRole::Moderator), 'sanctum')->getJson('/api/v1/admin/moderation/queue?per_page=50')->json('data'));
    }

    public function test_decisions_work_inside_and_answer_not_found_outside(): void
    {
        $own = $this->pendingPost($this->wwii);
        $foreign = $this->pendingPost($this->armor);
        $foreignListing = $this->pendingListing($this->armor);
        $community = $this->pendingCommunity();
        $admin = $this->categoryAdmin($this->aviation);

        $this->actingAs($admin, 'sanctum')->postJson("/api/v1/admin/moderation/posts/{$own->uuid}/approve")->assertOk();
        $this->assertSame(ContentStatus::Published, $own->fresh()->status);

        $this->actingAs($admin, 'sanctum')->postJson("/api/v1/admin/moderation/posts/{$foreign->uuid}/approve")->assertNotFound();
        $this->actingAs($admin, 'sanctum')->postJson("/api/v1/admin/moderation/posts/{$foreign->uuid}/reject", ['reason' => 'Не по теме направления'])->assertNotFound();
        $this->actingAs($admin, 'sanctum')->postJson("/api/v1/admin/moderation/listings/{$foreignListing->uuid}/revision", ['comment' => 'Уточните масштаб модели'])->assertNotFound();
        $this->actingAs($admin, 'sanctum')->postJson("/api/v1/admin/moderation/communities/{$community->uuid}/approve")->assertNotFound();

        $this->assertSame(ContentStatus::PendingModeration, $foreign->fresh()->status);
        $this->assertSame(CommunityStatus::Pending, $community->fresh()->status);
    }

    public function test_lists_and_direct_links_hide_foreign_posts_and_listings(): void
    {
        $own = $this->pendingPost($this->aviation);
        $foreign = $this->pendingPost($this->armor);
        $ownListing = $this->pendingListing($this->aviation);
        $foreignListing = $this->pendingListing($this->armor);
        $admin = $this->categoryAdmin($this->aviation);

        $posts = collect($this->actingAs($admin, 'sanctum')->getJson('/api/v1/admin/posts')->assertOk()->json('data'))->pluck('uuid')->all();
        $this->assertContains($own->uuid, $posts);
        $this->assertNotContains($foreign->uuid, $posts);

        $listings = collect($this->actingAs($admin, 'sanctum')->getJson('/api/v1/admin/listings')->assertOk()->json('data'))->pluck('uuid')->all();
        $this->assertContains($ownListing->uuid, $listings);
        $this->assertNotContains($foreignListing->uuid, $listings);

        $this->actingAs($admin, 'sanctum')->getJson("/api/v1/admin/listings/{$foreignListing->uuid}")->assertNotFound();
        $this->actingAs($admin, 'sanctum')->patchJson("/api/v1/admin/listings/{$foreignListing->uuid}", ['title' => 'Чужое'])->assertNotFound();
        $this->actingAs($admin, 'sanctum')->patchJson("/api/v1/admin/posts/{$foreign->uuid}", ['status' => 'hidden'])->assertNotFound();

        // Своё — правит и снимает, но не удаляет.
        $this->actingAs($admin, 'sanctum')->getJson("/api/v1/admin/listings/{$ownListing->uuid}")->assertOk();
        $this->actingAs($admin, 'sanctum')->patchJson("/api/v1/admin/listings/{$ownListing->uuid}", ['title' => 'Правка'])->assertOk();
        $this->actingAs($admin, 'sanctum')->patchJson("/api/v1/admin/posts/{$own->uuid}", ['status' => 'hidden'])->assertOk();
        $this->actingAs($admin, 'sanctum')->deleteJson("/api/v1/admin/posts/{$own->uuid}")->assertForbidden();
        $this->actingAs($admin, 'sanctum')->deleteJson("/api/v1/admin/listings/{$ownListing->uuid}")->assertForbidden();
        $this->assertNull($own->fresh()->deleted_at);
    }

    public function test_subcategory_assignment_and_listing_subcategory_branch(): void
    {
        // Назначено только подкатегорией: видит её, но не родителя.
        $admin = $this->categoryAdmin($this->wwii);
        $parentPost = $this->pendingPost($this->aviation);
        $childPost = $this->pendingPost($this->wwii);

        $posts = collect($this->actingAs($admin, 'sanctum')->getJson('/api/v1/admin/posts')->json('data'))->pluck('uuid')->all();
        $this->assertContains($childPost->uuid, $posts);
        $this->assertNotContains($parentPost->uuid, $posts);

        // Объявление, у которого подкатегория в области, а категория — нет.
        $taxonomy = app(CategoryTaxonomyService::class);
        $listing = $this->pendingListing($this->armor);
        $listing->forceFill(['subcategory_id' => $taxonomy->listingIdsForPostCategory($this->wwii->id)[0]])->save();
        $this->actingAs($admin, 'sanctum')->getJson("/api/v1/admin/listings/{$listing->uuid}")->assertOk();
    }

    public function test_status_changes_are_limited_to_edit_and_unpublish(): void
    {
        $admin = $this->categoryAdmin($this->aviation);
        $listing = $this->pendingListing($this->aviation);
        $post = $this->pendingPost($this->aviation);

        // Правка без смены статуса — как с формы, которая шлёт статус всегда.
        $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/v1/admin/listings/{$listing->uuid}", ['status' => 'pending_moderation', 'title' => 'Уточнённый заголовок'])
            ->assertOk();
        $this->assertSame('Уточнённый заголовок', $listing->fresh()->title);

        $this->actingAs($admin, 'sanctum')->patchJson("/api/v1/admin/listings/{$listing->uuid}", ['status' => 'sold'])->assertStatus(422);
        $this->actingAs($admin, 'sanctum')->patchJson("/api/v1/admin/listings/{$listing->uuid}", ['status' => 'published'])->assertOk();
        $this->assertSame(ListingStatus::Published, $listing->fresh()->status);
        $this->actingAs($admin, 'sanctum')->patchJson("/api/v1/admin/listings/{$listing->uuid}", ['status' => 'unpublished'])->assertOk();

        $this->actingAs($admin, 'sanctum')->patchJson("/api/v1/admin/posts/{$post->uuid}", ['status' => 'archived'])->assertStatus(422);
        $this->actingAs($admin, 'sanctum')->patchJson("/api/v1/admin/posts/{$post->uuid}", ['status' => 'hidden'])->assertOk();
    }

    public function test_moderator_still_deletes(): void
    {
        $moderator = $this->person(UserRole::Moderator);
        $post = $this->pendingPost($this->armor);
        $listing = $this->pendingListing($this->armor);

        $this->actingAs($moderator, 'sanctum')->deleteJson("/api/v1/admin/posts/{$post->uuid}")->assertOk();
        $this->actingAs($moderator, 'sanctum')->deleteJson("/api/v1/admin/listings/{$listing->uuid}")->assertOk();
    }

    public function test_channel_copies_in_the_feed_are_out_of_scope(): void
    {
        $admin = $this->categoryAdmin($this->aviation);
        $owner = $this->person();
        $channel = Channel::create(['owner_id' => $owner->id, 'name' => 'К', 'slug' => 'k-'.uniqid(), 'kind' => 'author', 'comments_enabled' => true]);
        $mirror = $this->pendingPost($this->aviation);
        ChannelPost::query()->create([
            'uuid' => (string) Str::uuid(),
            'channel_id' => $channel->id,
            'author_id' => $owner->id,
            'feed_post_id' => $mirror->id,
            'text' => 'Запись канала',
            'status' => 'pending',
        ]);

        $this->actingAs($admin, 'sanctum')->patchJson("/api/v1/admin/posts/{$mirror->uuid}", ['status' => 'published'])->assertNotFound();
        $posts = collect($this->actingAs($admin, 'sanctum')->getJson('/api/v1/admin/posts')->json('data'))->pluck('uuid')->all();
        $this->assertNotContains($mirror->uuid, $posts);
    }

    public function test_deleted_account_frees_its_place(): void
    {
        SystemSetting::query()->updateOrCreate(
            ['key' => CategoryAdminService::SETTING_KEY],
            ['value' => ['value' => 1], 'group' => 'moderation'],
        );
        $gone = $this->categoryAdmin($this->aviation);
        $gone->delete();

        $this->assertSame(0, DB::table('category_admins')->where('user_id', $gone->id)->count());
        $next = $this->person(UserRole::CategoryAdmin);
        $this->actingAs($this->person(UserRole::Owner), 'sanctum')
            ->putJson("/api/v1/admin/users/{$next->uuid}/categories", ['category_ids' => [$this->aviation->id]])
            ->assertOk();
    }

    public function test_access_map_for_category_admin(): void
    {
        $admin = $this->categoryAdmin($this->aviation);

        $data = $this->actingAs($admin, 'sanctum')->getJson('/api/v1/admin/access')->assertOk()->json('data');
        $this->assertSame(['content', 'ads', 'moderation'], $data['sections']);
        $this->assertSame([], $data['capabilities']);
        $this->assertSame([['id' => $this->aviation->id, 'name' => 'Авиация', 'slug' => 'aviation']], $data['categories']);

        foreach (['/api/v1/admin/reports', '/api/v1/admin/users', '/api/v1/admin/feedback', '/api/v1/admin/communities/applications'] as $url) {
            $this->actingAs($admin, 'sanctum')->getJson($url)->assertForbidden();
        }
    }

    public function test_category_admin_without_directions_sees_nothing(): void
    {
        $this->pendingPost($this->aviation);
        $admin = $this->categoryAdmin();

        $this->assertSame([], $this->actingAs($admin, 'sanctum')->getJson('/api/v1/admin/moderation/queue')->assertOk()->json('data'));
        $this->assertSame([], $this->actingAs($admin, 'sanctum')->getJson('/api/v1/admin/posts')->assertOk()->json('data'));
    }

    public function test_owner_assigns_directions_within_the_threshold(): void
    {
        $owner = $this->person(UserRole::Owner);
        $admin = $this->person(UserRole::CategoryAdmin);
        $plain = $this->person();

        $this->actingAs($owner, 'sanctum')
            ->putJson("/api/v1/admin/users/{$plain->uuid}/categories", ['category_ids' => [$this->aviation->id]])
            ->assertStatus(422);

        $this->actingAs($owner, 'sanctum')
            ->putJson("/api/v1/admin/users/{$admin->uuid}/categories", ['category_ids' => [$this->aviation->id, $this->armor->id]])
            ->assertOk()
            ->assertJsonPath('data.max_per_category', 10)
            ->assertJsonCount(2, 'data.categories');

        SystemSetting::query()->updateOrCreate(
            ['key' => CategoryAdminService::SETTING_KEY],
            ['value' => ['value' => 1], 'group' => 'moderation'],
        );
        $second = $this->person(UserRole::CategoryAdmin);
        $this->actingAs($owner, 'sanctum')
            ->putJson("/api/v1/admin/users/{$second->uuid}/categories", ['category_ids' => [$this->armor->id]])
            ->assertStatus(422);

        // Снять направление — можно и сверх предела.
        $this->actingAs($owner, 'sanctum')
            ->putJson("/api/v1/admin/users/{$admin->uuid}/categories", ['category_ids' => [$this->aviation->id]])
            ->assertOk()
            ->assertJsonCount(1, 'data.categories');

        $this->actingAs($this->person(UserRole::Moderator), 'sanctum')
            ->putJson("/api/v1/admin/users/{$admin->uuid}/categories", ['category_ids' => []])
            ->assertForbidden();
    }

    public function test_changing_role_away_removes_assignments(): void
    {
        $owner = $this->person(UserRole::Owner);
        $admin = $this->categoryAdmin($this->aviation);

        $this->actingAs($owner, 'sanctum')->patchJson("/api/v1/admin/users/{$admin->uuid}", ['role' => 'user'])->assertOk();

        $this->assertSame(0, DB::table('category_admins')->where('user_id', $admin->id)->count());
    }

    public function test_numismatics_is_not_added_to_an_empty_tree(): void
    {
        PostCategory::query()->delete();
        $migration = require database_path('migrations/2026_09_19_150100_add_numismatics_direction.php');
        $migration->up();

        $this->assertSame(0, PostCategory::query()->count());
    }

    public function test_numismatics_is_a_top_level_direction_with_catalog_mirrors(): void
    {
        $migration = require database_path('migrations/2026_09_19_150100_add_numismatics_direction.php');
        $migration->up();
        $migration->up(); // повтор ничего не добавляет

        $this->assertSame(1, PostCategory::query()->where('slug', 'numismatics')->count());
        $numismatics = PostCategory::query()->where('slug', 'numismatics')->firstOrFail();
        $this->assertSame((int) $this->armor->sort_order + 1, (int) $numismatics->sort_order, 'рядом с бронетехникой');

        $this->assertNull($numismatics->parent_id);
        $this->assertSame('Нумизматика', $numismatics->name);
        $this->assertSame(0, PostCategory::query()->where('parent_id', $numismatics->id)->count(), 'подкатегорий нет');
        $this->assertNotNull($numismatics->listing_category_id);
        $this->assertSame('numismatics', ListingCategory::query()->whereKey($numismatics->listing_category_id)->value('slug'));
    }
}

<?php

namespace Tests\Feature;

use App\Enums\CommunityStatus;
use App\Enums\UserStatus;
use App\Models\Community;
use App\Models\CommunityCategory;
use App\Models\PostCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CatalogCommunityTest extends TestCase
{
    use RefreshDatabase;

    public function test_post_category_tree_returns_nested_structure(): void
    {
        $root = PostCategory::create([
            'name' => 'Aviation',
            'slug' => 'aviation',
            'sort_order' => 10,
            'depth' => 0,
            'path' => 'aviation',
            'is_active' => true,
        ]);

        PostCategory::create([
            'parent_id' => $root->id,
            'name' => 'WWII',
            'slug' => 'wwii',
            'sort_order' => 10,
            'depth' => 1,
            'path' => 'aviation/wwii',
            'is_active' => true,
        ]);

        $this->getJson('/api/v1/categories/posts')
            ->assertOk()
            ->assertJsonPath('data.0.slug', 'aviation')
            ->assertJsonPath('data.0.children.0.slug', 'wwii');
    }

    public function test_user_can_join_and_leave_community(): void
    {
        $category = CommunityCategory::create([
            'name' => 'Official',
            'slug' => 'official',
            'sort_order' => 1,
            'depth' => 0,
            'is_active' => true,
        ]);

        $community = Community::create([
            'category_id' => $category->id,
            'name' => 'Test Club',
            'slug' => 'test-club',
            'status' => CommunityStatus::Active,
            'approved_at' => now(),
        ]);

        $user = User::factory()->create(['status' => UserStatus::Active]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/communities/test-club/join')
            ->assertOk();

        $this->assertDatabaseHas('community_members', [
            'community_id' => $community->id,
            'user_id' => $user->id,
        ]);

        $this->actingAs($user, 'sanctum')
            ->deleteJson('/api/v1/communities/test-club/leave')
            ->assertOk();

        $this->assertDatabaseMissing('community_members', [
            'community_id' => $community->id,
            'user_id' => $user->id,
        ]);
    }
}

<?php

namespace Tests\Feature;

use App\Enums\CommunityMemberRole;
use App\Enums\CommunityStatus;
use App\Enums\UserStatus;
use App\Models\Community;
use App\Models\CommunityCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CommunityUpdateTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_can_update_community_profile(): void
    {
        $owner = User::factory()->create(['status' => UserStatus::Active]);
        $other = User::factory()->create(['status' => UserStatus::Active]);

        $category = CommunityCategory::create([
            'name' => 'Авиация',
            'slug' => 'aviation',
            'is_active' => true,
        ]);
        $nextCategory = CommunityCategory::create([
            'name' => 'Бронетехника',
            'slug' => 'armor',
            'is_active' => true,
        ]);

        $community = Community::create([
            'name' => 'Old Community',
            'slug' => 'old-community',
            'description' => 'Old desc',
            'category_id' => $category->id,
            'status' => CommunityStatus::Active,
            'created_by' => $owner->id,
        ]);
        $community->members()->attach($owner->id, [
            'role' => CommunityMemberRole::Owner->value,
            'joined_at' => now(),
        ]);

        $this->actingAs($owner, 'sanctum')
            ->patchJson("/api/v1/communities/{$community->slug}", [
                'name' => 'New Community',
                'description' => 'New description',
                'category_id' => $nextCategory->id,
            ])
            ->assertOk()
            ->assertJsonPath('data.name', 'Old Community')
            ->assertJsonPath('data.description', 'Old desc')
            ->assertJsonPath('data.category.name', 'Авиация');

        $community->refresh();
        $this->assertSame('New Community', $community->settings['pending_revision']['name'] ?? null);
        $this->assertSame('New description', $community->settings['pending_revision']['description'] ?? null);
        $this->assertSame($nextCategory->id, $community->settings['pending_revision']['category_id'] ?? null);
        $this->assertDatabaseHas('moderation_queue', [
            'moderatable_type' => Community::class,
            'moderatable_id' => $community->id,
            'queue' => 'communities',
            'status' => 'pending',
        ]);

        $this->actingAs($other, 'sanctum')
            ->patchJson("/api/v1/communities/{$community->slug}", [
                'name' => 'Hacked',
            ])
            ->assertStatus(403);
    }
}

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

class CommunityDeleteTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_can_delete_community_with_name_confirmation(): void
    {
        $owner = User::factory()->create(['status' => UserStatus::Active]);
        $other = User::factory()->create(['status' => UserStatus::Active]);
        $category = CommunityCategory::create([
            'name' => 'Official',
            'slug' => 'official-delete',
            'sort_order' => 1,
            'depth' => 0,
            'is_active' => true,
        ]);

        $community = Community::create([
            'category_id' => $category->id,
            'name' => 'Temp Club',
            'slug' => 'temp-club',
            'description' => 'Desc',
            'status' => CommunityStatus::Active,
            'approved_at' => now(),
            'created_by' => $owner->id,
            'members_count' => 1,
        ]);

        $community->members()->attach($owner->id, [
            'role' => CommunityMemberRole::Owner->value,
            'joined_at' => now(),
        ]);

        $this->actingAs($owner, 'sanctum')
            ->deleteJson("/api/v1/communities/{$community->slug}", [
                'confirm_name' => 'Wrong name',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['confirm_name']);

        $this->actingAs($owner, 'sanctum')
            ->deleteJson("/api/v1/communities/{$community->slug}", [
                'confirm_name' => 'Temp Club',
            ])
            ->assertOk();

        $this->assertSoftDeleted('communities', ['id' => $community->id]);

        $this->actingAs($other, 'sanctum')
            ->getJson("/api/v1/communities/{$community->slug}")
            ->assertNotFound();
    }

    public function test_non_owner_cannot_delete_community(): void
    {
        $owner = User::factory()->create(['status' => UserStatus::Active]);
        $other = User::factory()->create(['status' => UserStatus::Active]);
        $category = CommunityCategory::create([
            'name' => 'Official',
            'slug' => 'official-delete-2',
            'sort_order' => 1,
            'depth' => 0,
            'is_active' => true,
        ]);

        $community = Community::create([
            'category_id' => $category->id,
            'name' => 'Protected Club',
            'slug' => 'protected-club',
            'status' => CommunityStatus::Active,
            'approved_at' => now(),
            'created_by' => $owner->id,
        ]);

        $this->actingAs($other, 'sanctum')
            ->deleteJson("/api/v1/communities/{$community->slug}", [
                'confirm_name' => 'Protected Club',
            ])
            ->assertStatus(403);
    }
}

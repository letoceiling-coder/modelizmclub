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

class SyncCommunityCountersTest extends TestCase
{
    use RefreshDatabase;

    public function test_sync_counters_fixes_drifted_members_count(): void
    {
        $owner = User::factory()->create(['status' => UserStatus::Active]);
        $member = User::factory()->create(['status' => UserStatus::Active]);
        $category = CommunityCategory::create([
            'name' => 'Sync',
            'slug' => 'sync-cat',
            'sort_order' => 1,
            'depth' => 0,
            'is_active' => true,
        ]);

        $community = Community::create([
            'category_id' => $category->id,
            'name' => 'Drift Club',
            'slug' => 'drift-club',
            'description' => 'Desc',
            'status' => CommunityStatus::Active,
            'approved_at' => now(),
            'created_by' => $owner->id,
            'members_count' => 0,
            'posts_count' => 0,
        ]);

        $community->members()->attach($owner->id, [
            'role' => CommunityMemberRole::Owner->value,
            'joined_at' => now(),
        ]);
        $community->members()->attach($member->id, [
            'role' => CommunityMemberRole::Member->value,
            'joined_at' => now(),
        ]);

        $this->artisan('communities:sync-counters')->assertSuccessful();

        $community->refresh();
        $this->assertSame(2, $community->members_count);
    }

    public function test_dry_run_does_not_persist_changes(): void
    {
        $owner = User::factory()->create(['status' => UserStatus::Active]);
        $category = CommunityCategory::create([
            'name' => 'Dry',
            'slug' => 'dry-cat',
            'sort_order' => 1,
            'depth' => 0,
            'is_active' => true,
        ]);

        $community = Community::create([
            'category_id' => $category->id,
            'name' => 'Dry Club',
            'slug' => 'dry-club',
            'description' => 'Desc',
            'status' => CommunityStatus::Active,
            'approved_at' => now(),
            'created_by' => $owner->id,
            'members_count' => 0,
        ]);

        $community->members()->attach($owner->id, [
            'role' => CommunityMemberRole::Owner->value,
            'joined_at' => now(),
        ]);

        $this->artisan('communities:sync-counters --dry-run')->assertSuccessful();

        $this->assertSame(0, $community->fresh()->members_count);
    }
}

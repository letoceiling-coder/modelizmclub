<?php

namespace Tests\Feature;

use App\Enums\CommunityStatus;
use App\Enums\MediaStatus;
use App\Enums\UserStatus;
use App\Models\Community;
use App\Models\CommunityCategory;
use App\Models\Media;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CommunityBrandingTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_can_update_community_branding(): void
    {
        $owner = User::factory()->create(['status' => UserStatus::Active]);
        $category = CommunityCategory::create([
            'name' => 'Official',
            'slug' => 'official-branding',
            'sort_order' => 1,
            'depth' => 0,
            'is_active' => true,
        ]);
        $community = Community::create([
            'category_id' => $category->id,
            'name' => 'Test Community',
            'slug' => 'test-community',
            'description' => 'Desc',
            'status' => CommunityStatus::Active,
            'approved_at' => now(),
            'created_by' => $owner->id,
        ]);

        $avatar = Media::create([
            'disk' => 's3',
            'path' => 'media/community/avatar.jpg',
            'filename' => 'avatar.jpg',
            'mime_type' => 'image/jpeg',
            'size_bytes' => 2048,
            'uploaded_by' => $owner->id,
            'status' => MediaStatus::Ready,
        ]);
        $cover = Media::create([
            'disk' => 's3',
            'path' => 'media/community/cover.jpg',
            'filename' => 'cover.jpg',
            'mime_type' => 'image/jpeg',
            'size_bytes' => 4096,
            'uploaded_by' => $owner->id,
            'status' => MediaStatus::Ready,
        ]);

        $this->actingAs($owner, 'sanctum')
            ->patchJson("/api/v1/communities/{$community->slug}/branding", [
                'avatar_media_uuid' => $avatar->uuid,
                'cover_media_uuid' => $cover->uuid,
            ])
            ->assertOk()
            ->assertJsonPath('data.is_owner', true);

        $community->refresh();
        $this->assertSame($avatar->id, $community->settings['pending_revision']['avatar_media_id'] ?? null);
        $this->assertSame($cover->id, $community->settings['pending_revision']['cover_media_id'] ?? null);
        $this->assertDatabaseHas('moderation_queue', [
            'moderatable_type' => Community::class,
            'moderatable_id' => $community->id,
            'queue' => 'communities',
            'status' => 'pending',
        ]);
    }

    public function test_non_owner_cannot_update_community_branding(): void
    {
        $owner = User::factory()->create(['status' => UserStatus::Active]);
        $other = User::factory()->create(['status' => UserStatus::Active]);
        $category = CommunityCategory::create([
            'name' => 'Official',
            'slug' => 'official-branding-2',
            'sort_order' => 1,
            'depth' => 0,
            'is_active' => true,
        ]);
        $community = Community::create([
            'category_id' => $category->id,
            'name' => 'Test Community',
            'slug' => 'test-community-2',
            'description' => 'Desc',
            'status' => CommunityStatus::Active,
            'approved_at' => now(),
            'created_by' => $owner->id,
        ]);

        $this->actingAs($other, 'sanctum')
            ->patchJson("/api/v1/communities/{$community->slug}/branding", [
                'avatar_media_uuid' => null,
            ])
            ->assertForbidden();
    }
}

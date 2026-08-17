<?php

namespace Tests\Feature;

use App\Enums\ContentStatus;
use App\Enums\ListingStatus;
use App\Enums\UserRole;
use App\Models\Channel;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\Post;
use App\Models\PostCategory;
use App\Models\User;
use App\Models\UserProfile;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class AdminUserDeletionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    public function test_admin_can_permanently_delete_user_and_related_data(): void
    {
        $admin = User::factory()->create(['role' => UserRole::Admin]);
        $target = User::factory()->create(['email' => 'purge-me@example.com']);
        UserProfile::query()->create([
            'user_id' => $target->id,
            'display_name' => 'Purge Me',
            'slug' => 'purge-me',
            'privacy_settings' => UserProfile::DEFAULT_PRIVACY,
        ]);

        $category = PostCategory::query()->create([
            'name' => 'Test',
            'slug' => 'test-del',
            'sort_order' => 1,
            'depth' => 0,
            'is_active' => true,
        ]);

        Post::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $target->id,
            'category_id' => $category->id,
            'title' => 'Post to purge',
            'body' => 'Body',
            'status' => ContentStatus::Published,
        ]);

        Listing::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $target->id,
            'category_id' => ListingCategory::query()->create([
                'name' => 'Cat',
                'slug' => 'cat-del',
                'sort_order' => 1,
                'depth' => 0,
                'is_active' => true,
            ])->id,
            'title' => 'Listing to purge',
            'slug' => 'listing-purge',
            'description' => 'Desc',
            'status' => ListingStatus::Published,
            'price_cents' => 1000,
            'currency' => 'RUB',
        ]);

        Channel::query()->create([
            'uuid' => (string) Str::uuid(),
            'owner_id' => $target->id,
            'name' => 'Channel purge',
            'slug' => 'channel-purge',
            'is_active' => true,
        ]);

        $token = $admin->createToken('api')->plainTextToken;

        $this->deleteJson('/api/v1/admin/users/'.$target->uuid, [], [
            'Authorization' => 'Bearer '.$token,
        ])->assertOk()
            ->assertJsonPath('data.message', 'Пользователь и все связанные данные удалены.');

        $this->assertDatabaseMissing('users', ['id' => $target->id]);
        $this->assertDatabaseMissing('posts', ['user_id' => $target->id]);
        $this->assertDatabaseMissing('listings', ['user_id' => $target->id]);
        $this->assertDatabaseMissing('channels', ['owner_id' => $target->id]);
    }

    public function test_admin_cannot_delete_self(): void
    {
        $admin = User::factory()->create(['role' => UserRole::Admin]);
        $token = $admin->createToken('api')->plainTextToken;

        $this->deleteJson('/api/v1/admin/users/'.$admin->uuid, [], [
            'Authorization' => 'Bearer '.$token,
        ])->assertStatus(422);
    }

    public function test_user_purge_command_rejects_last_superadmin(): void
    {
        $soleAdmin = User::factory()->create([
            'role' => UserRole::Admin,
            'email' => 'sole-admin@example.com',
        ]);

        $this->artisan('user:purge', [
            'identifier' => 'sole-admin@example.com',
            '--force' => true,
        ])->assertFailed();

        $this->assertDatabaseHas('users', ['id' => $soleAdmin->id]);
    }
}

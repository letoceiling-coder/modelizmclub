<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\User;
use App\Models\VideoCategory;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class AdminVideoCategoryTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    public function test_admin_can_list_video_categories(): void
    {
        VideoCategory::query()->create([
            'uuid' => (string) Str::uuid(),
            'title' => 'Авиация',
            'slug' => 'aviation-'.uniqid(),
            'sort_order' => 1,
        ]);

        $admin = User::factory()->create(['role' => UserRole::Admin]);
        $token = $admin->createToken('api')->plainTextToken;

        $this->getJson('/api/v1/admin/categories/video', ['Authorization' => 'Bearer '.$token])
            ->assertOk()
            ->assertJsonPath('data.data.0.name', 'Авиация');
    }

    public function test_admin_can_crud_video_category(): void
    {
        $admin = User::factory()->create(['role' => UserRole::Admin]);
        $token = $admin->createToken('api')->plainTextToken;
        $headers = ['Authorization' => 'Bearer '.$token];

        $create = $this->postJson('/api/v1/admin/categories/video', [
            'name' => 'Суда',
            'slug' => 'ships-'.uniqid(),
            'sort_order' => 2,
            'is_active' => true,
        ], $headers)->assertCreated()
            ->assertJsonPath('data.is_active', true)
            ->assertJsonPath('data.videos_count', 0);

        $id = $create->json('data.id');

        $this->putJson('/api/v1/admin/categories/video/'.$id, [
            'name' => 'Флот',
            'slug' => 'fleet-'.uniqid(),
            'sort_order' => 3,
            'is_active' => false,
        ], $headers)->assertOk()
            ->assertJsonPath('data.name', 'Флот')
            ->assertJsonPath('data.is_active', false);

        $this->deleteJson('/api/v1/admin/categories/video/'.$id, [], $headers)
            ->assertOk();

        $this->assertDatabaseMissing('video_categories', ['id' => $id]);
    }

    public function test_admin_can_reorder_video_categories(): void
    {
        $a = VideoCategory::query()->create([
            'uuid' => (string) Str::uuid(),
            'title' => 'A',
            'slug' => 'a-'.uniqid(),
            'sort_order' => 10,
        ]);
        $b = VideoCategory::query()->create([
            'uuid' => (string) Str::uuid(),
            'title' => 'B',
            'slug' => 'b-'.uniqid(),
            'sort_order' => 20,
        ]);

        $admin = User::factory()->create(['role' => UserRole::Admin]);
        $token = $admin->createToken('api')->plainTextToken;

        $this->patchJson('/api/v1/admin/categories/video/reorder', [
            'ids' => [$b->id, $a->id],
        ], ['Authorization' => 'Bearer '.$token])
            ->assertOk();

        $this->assertSame(10, $b->fresh()->sort_order);
        $this->assertSame(20, $a->fresh()->sort_order);
    }

    public function test_public_video_categories_hide_inactive(): void
    {
        VideoCategory::query()->create([
            'uuid' => (string) Str::uuid(),
            'title' => 'Visible',
            'slug' => 'visible-'.uniqid(),
            'sort_order' => 1,
            'is_active' => true,
        ]);
        VideoCategory::query()->create([
            'uuid' => (string) Str::uuid(),
            'title' => 'Hidden',
            'slug' => 'hidden-'.uniqid(),
            'sort_order' => 2,
            'is_active' => false,
        ]);

        $res = $this->getJson('/api/v1/videos/categories')->assertOk();
        $titles = collect($res->json('data'))->pluck('title')->all();

        $this->assertContains('Visible', $titles);
        $this->assertNotContains('Hidden', $titles);
    }

    public function test_moderator_cannot_manage_video_categories(): void
    {
        $moderator = User::factory()->create(['role' => UserRole::Moderator]);
        $token = $moderator->createToken('api')->plainTextToken;

        $this->postJson('/api/v1/admin/categories/video', [
            'name' => 'Test',
            'slug' => 'test-'.uniqid(),
        ], ['Authorization' => 'Bearer '.$token])
            ->assertForbidden();
    }
}

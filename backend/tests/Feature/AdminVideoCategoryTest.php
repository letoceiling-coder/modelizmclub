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
        ], $headers)->assertCreated();

        $id = $create->json('data.id');

        $this->putJson('/api/v1/admin/categories/video/'.$id, [
            'name' => 'Флот',
            'slug' => 'fleet-'.uniqid(),
            'sort_order' => 3,
        ], $headers)->assertOk()
            ->assertJsonPath('data.name', 'Флот');

        $this->deleteJson('/api/v1/admin/categories/video/'.$id, [], $headers)
            ->assertOk();

        $this->assertDatabaseMissing('video_categories', ['id' => $id]);
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

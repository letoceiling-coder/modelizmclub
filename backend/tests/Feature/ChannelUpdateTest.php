<?php

namespace Tests\Feature;

use App\Enums\UserStatus;
use App\Models\Channel;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ChannelUpdateTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_can_update_channel_profile(): void
    {
        $owner = User::factory()->create(['status' => UserStatus::Active]);
        $other = User::factory()->create(['status' => UserStatus::Active]);

        $channel = Channel::create([
            'owner_id' => $owner->id,
            'name' => 'Old Name',
            'slug' => 'old-name',
            'description' => 'Old desc',
            'category' => 'Авиация',
            'kind' => 'author',
            'is_active' => true,
        ]);

        $this->actingAs($owner, 'sanctum')
            ->patchJson("/api/v1/channels/{$channel->slug}", [
                'name' => 'New Name',
                'description' => 'New description',
                'category' => 'Бронетехника',
                'kind' => 'expert',
            ])
            ->assertOk()
            ->assertJsonPath('data.name', 'New Name')
            ->assertJsonPath('data.description', 'New description')
            ->assertJsonPath('data.category', 'Бронетехника')
            ->assertJsonPath('data.kind', 'expert');

        $this->assertDatabaseHas('channels', [
            'id' => $channel->id,
            'slug' => 'old-name',
            'name' => 'New Name',
        ]);

        $this->actingAs($other, 'sanctum')
            ->patchJson("/api/v1/channels/{$channel->slug}", [
                'name' => 'Hacked',
            ])
            ->assertStatus(403);
    }
}

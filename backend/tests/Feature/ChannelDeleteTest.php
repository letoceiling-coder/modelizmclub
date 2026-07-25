<?php

namespace Tests\Feature;

use App\Enums\UserStatus;
use App\Models\Channel;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ChannelDeleteTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_can_delete_channel_with_name_confirmation(): void
    {
        $owner = User::factory()->create(['status' => UserStatus::Active]);
        $other = User::factory()->create(['status' => UserStatus::Active]);

        $channel = Channel::create([
            'owner_id' => $owner->id,
            'name' => 'Temp Channel',
            'slug' => 'temp-channel',
            'kind' => 'author',
            'is_active' => true,
        ]);

        $this->actingAs($owner, 'sanctum')
            ->deleteJson("/api/v1/channels/{$channel->slug}", [
                'confirm_name' => 'Wrong name',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['confirm_name']);

        $this->actingAs($owner, 'sanctum')
            ->deleteJson("/api/v1/channels/{$channel->slug}", [
                'confirm_name' => 'Temp Channel',
            ])
            ->assertOk();

        $this->assertSoftDeleted('channels', ['id' => $channel->id]);

        $this->actingAs($other, 'sanctum')
            ->getJson("/api/v1/channels/{$channel->slug}")
            ->assertNotFound();
    }

    public function test_non_owner_cannot_delete_channel(): void
    {
        $owner = User::factory()->create(['status' => UserStatus::Active]);
        $other = User::factory()->create(['status' => UserStatus::Active]);

        $channel = Channel::create([
            'owner_id' => $owner->id,
            'name' => 'Protected Channel',
            'slug' => 'protected-channel',
            'kind' => 'author',
            'is_active' => true,
        ]);

        $this->actingAs($other, 'sanctum')
            ->deleteJson("/api/v1/channels/{$channel->slug}", [
                'confirm_name' => 'Protected Channel',
            ])
            ->assertStatus(403);
    }
}

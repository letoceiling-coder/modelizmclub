<?php

namespace Tests\Feature;

use App\Enums\UserStatus;
use App\Models\Channel;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ChannelOwnerTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_sees_is_owner_in_channel_list_and_show(): void
    {
        $owner = User::factory()->create(['status' => UserStatus::Active]);
        $other = User::factory()->create(['status' => UserStatus::Active]);

        $channel = Channel::create([
            'owner_id' => $owner->id,
            'name' => 'Owner Channel',
            'slug' => 'owner-channel',
            'kind' => 'author',
            'is_active' => true,
        ]);

        $this->actingAs($owner, 'sanctum')
            ->getJson('/api/v1/channels')
            ->assertOk()
            ->assertJsonPath('data.0.slug', $channel->slug)
            ->assertJsonPath('data.0.is_owner', true);

        $this->actingAs($owner, 'sanctum')
            ->getJson("/api/v1/channels/{$channel->slug}")
            ->assertOk()
            ->assertJsonPath('data.is_owner', true);

        $this->actingAs($other, 'sanctum')
            ->getJson('/api/v1/channels')
            ->assertOk()
            ->assertJsonPath('data.0.is_owner', false);
    }

    public function test_owner_cannot_subscribe_to_own_channel(): void
    {
        $owner = User::factory()->create(['status' => UserStatus::Active]);

        $channel = Channel::create([
            'owner_id' => $owner->id,
            'name' => 'Self Channel',
            'slug' => 'self-channel',
            'kind' => 'author',
            'is_active' => true,
        ]);

        $this->actingAs($owner, 'sanctum')
            ->postJson("/api/v1/channels/{$channel->slug}/subscribe")
            ->assertStatus(422)
            ->assertJsonPath('message', 'Нельзя подписаться на собственный канал.');
    }
}

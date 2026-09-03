<?php

namespace Tests\Feature\Policies;

use App\Enums\UserRole;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ListingPolicyTest extends TestCase
{
    use PolicyFixtures;
    use RefreshDatabase;

    public function test_stranger_cannot_update_listing(): void
    {
        $listing = $this->seedListing($this->seedUser('owner'));

        $this->actingAs($this->seedUser('other'), 'sanctum')
            ->patchJson("/api/v1/listings/{$listing->uuid}", ['title' => 'Hijack'])
            ->assertForbidden();
    }

    public function test_guest_cannot_update_listing(): void
    {
        $listing = $this->seedListing($this->seedUser('owner'));

        $this->patchJson("/api/v1/listings/{$listing->uuid}", ['title' => 'Hijack'])->assertUnauthorized();
    }

    public function test_owner_deletes_and_restores_listing(): void
    {
        $owner = $this->seedUser('owner');
        $listing = $this->seedListing($owner);

        $this->actingAs($owner, 'sanctum')
            ->deleteJson("/api/v1/listings/{$listing->uuid}")
            ->assertOk();
        $this->assertSoftDeleted('listings', ['id' => $listing->id]);

        $this->actingAs($owner, 'sanctum')
            ->postJson("/api/v1/listings/{$listing->uuid}/restore")
            ->assertOk()
            ->assertJsonPath('data.can.edit', true)
            ->assertJsonPath('data.can.promote', true);
    }

    public function test_stranger_cannot_delete_or_restore_listing(): void
    {
        $listing = $this->seedListing($this->seedUser('owner'));
        $stranger = $this->seedUser('other');

        $this->actingAs($stranger, 'sanctum')
            ->deleteJson("/api/v1/listings/{$listing->uuid}")
            ->assertForbidden();

        $listing->delete();
        $this->actingAs($stranger, 'sanctum')
            ->postJson("/api/v1/listings/{$listing->uuid}/restore")
            ->assertForbidden();
    }

    public function test_stranger_cannot_promote_listing(): void
    {
        $listing = $this->seedListing($this->seedUser('owner'));

        $this->actingAs($this->seedUser('other'), 'sanctum')
            ->postJson("/api/v1/listings/{$listing->uuid}/promote", ['package' => 'top_3d'])
            ->assertForbidden();
    }

    public function test_moderator_may_delete_but_not_promote(): void
    {
        $listing = $this->seedListing($this->seedUser('owner'));
        $moderator = $this->seedUser('mod', UserRole::Moderator);

        $this->assertTrue($moderator->can('delete', $listing));
        $this->assertTrue($moderator->can('update', $listing));
        $this->assertFalse($moderator->can('promote', $listing));
    }

    public function test_listing_payload_carries_can_flags_for_stranger(): void
    {
        $listing = $this->seedListing($this->seedUser('owner'));

        $this->actingAs($this->seedUser('other'), 'sanctum')
            ->getJson("/api/v1/listings/{$listing->uuid}")
            ->assertOk()
            ->assertJsonPath('data.can.edit', false)
            ->assertJsonPath('data.can.delete', false);
    }
}

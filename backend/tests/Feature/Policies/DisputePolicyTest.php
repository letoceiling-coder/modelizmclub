<?php

namespace Tests\Feature\Policies;

use App\Enums\SafeDealStatus;
use App\Enums\UserRole;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DisputePolicyTest extends TestCase
{
    use PolicyFixtures;
    use RefreshDatabase;

    public function test_deal_parties_may_view_and_add_evidence(): void
    {
        $buyer = $this->seedUser('buyer');
        $seller = $this->seedUser('seller');
        $deal = $this->seedDeal($buyer, $seller, SafeDealStatus::Disputed);
        $dispute = $this->seedDispute($deal, $buyer);

        $this->assertTrue($buyer->can('view', $dispute));
        $this->assertTrue($seller->can('addEvidence', $dispute));
        $this->assertFalse($buyer->can('resolve', $dispute));
    }

    public function test_stranger_may_not_view_dispute(): void
    {
        $deal = $this->seedDeal($this->seedUser('buyer'), $this->seedUser('seller'), SafeDealStatus::Disputed);
        $dispute = $this->seedDispute($deal, $deal->buyer);

        $stranger = $this->seedUser('other');
        $this->assertFalse($stranger->can('view', $dispute));
        $this->assertFalse($stranger->can('addEvidence', $dispute));
    }

    public function test_moderator_resolves_dispute(): void
    {
        $deal = $this->seedDeal($this->seedUser('buyer'), $this->seedUser('seller'), SafeDealStatus::Disputed);
        $dispute = $this->seedDispute($deal, $deal->buyer);

        $this->assertTrue($this->seedUser('mod', UserRole::Moderator)->can('resolve', $dispute));
    }

    public function test_deal_payload_carries_dispute_can_block(): void
    {
        $buyer = $this->seedUser('buyer');
        $deal = $this->seedDeal($buyer, $this->seedUser('seller'), SafeDealStatus::Disputed);
        $this->seedDispute($deal, $buyer);

        $this->actingAs($buyer, 'sanctum')
            ->getJson("/api/v1/safe-deals/{$deal->uuid}")
            ->assertOk()
            ->assertJsonPath('data.dispute.can.view', true)
            ->assertJsonPath('data.dispute.can.addEvidence', true)
            ->assertJsonPath('data.dispute.can.resolve', false);
    }
}

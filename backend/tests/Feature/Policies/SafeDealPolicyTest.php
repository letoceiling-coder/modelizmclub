<?php

namespace Tests\Feature\Policies;

use App\Enums\SafeDealStatus;
use App\Enums\UserRole;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SafeDealPolicyTest extends TestCase
{
    use PolicyFixtures;
    use RefreshDatabase;

    public function test_buyer_views_own_deal_with_can_flags(): void
    {
        $buyer = $this->seedUser('buyer');
        $seller = $this->seedUser('seller');
        $deal = $this->seedDeal($buyer, $seller);

        $this->actingAs($buyer, 'sanctum')
            ->getJson("/api/v1/safe-deals/{$deal->uuid}")
            ->assertOk()
            ->assertJsonPath('data.can.view', true)
            ->assertJsonPath('data.can.confirmDelivery', true)
            ->assertJsonPath('data.can.ship', false);
    }

    public function test_seller_views_own_deal_and_may_ship(): void
    {
        $buyer = $this->seedUser('buyer');
        $seller = $this->seedUser('seller');
        $deal = $this->seedDeal($buyer, $seller);

        $this->actingAs($seller, 'sanctum')
            ->getJson("/api/v1/safe-deals/{$deal->uuid}")
            ->assertOk()
            ->assertJsonPath('data.can.ship', true)
            ->assertJsonPath('data.can.confirmDelivery', false);
    }

    public function test_stranger_gets_403_on_deal(): void
    {
        $deal = $this->seedDeal($this->seedUser('buyer'), $this->seedUser('seller'));

        $this->actingAs($this->seedUser('other'), 'sanctum')
            ->getJson("/api/v1/safe-deals/{$deal->uuid}")
            ->assertForbidden();
    }

    public function test_guest_gets_401_on_deal(): void
    {
        $deal = $this->seedDeal($this->seedUser('buyer'), $this->seedUser('seller'));

        $this->getJson("/api/v1/safe-deals/{$deal->uuid}")->assertUnauthorized();
    }

    public function test_moderator_views_any_deal(): void
    {
        $deal = $this->seedDeal($this->seedUser('buyer'), $this->seedUser('seller'));

        $this->actingAs($this->seedUser('mod', UserRole::Moderator), 'sanctum')
            ->getJson("/api/v1/safe-deals/{$deal->uuid}")
            ->assertOk();
    }

    public function test_seller_ships_paid_deal(): void
    {
        $buyer = $this->seedUser('buyer');
        $seller = $this->seedUser('seller');
        $deal = $this->seedDeal($buyer, $seller, SafeDealStatus::Paid);

        $this->actingAs($seller, 'sanctum')
            ->postJson("/api/v1/safe-deals/{$deal->uuid}/ship", [])
            ->assertOk()
            ->assertJsonPath('data.status', 'shipped');
    }

    public function test_buyer_cannot_ship(): void
    {
        $buyer = $this->seedUser('buyer');
        $deal = $this->seedDeal($buyer, $this->seedUser('seller'));

        $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/safe-deals/{$deal->uuid}/ship", [])
            ->assertForbidden();
    }

    public function test_stranger_is_forbidden_on_every_deal_action(): void
    {
        $deal = $this->seedDeal($this->seedUser('buyer'), $this->seedUser('seller'));
        $stranger = $this->seedUser('other');

        foreach ([
            ['confirm', []],
            ['cancel', []],
            ['dispute', ['reason' => 'not_received', 'description' => 'x']],
            ['review', ['rating' => 5, 'text' => 'ok']],
        ] as [$action, $body]) {
            $this->actingAs($stranger, 'sanctum')
                ->postJson("/api/v1/safe-deals/{$deal->uuid}/{$action}", $body)
                ->assertForbidden();
        }
    }

    public function test_seller_cannot_confirm_delivery(): void
    {
        $seller = $this->seedUser('seller');
        $deal = $this->seedDeal($this->seedUser('buyer'), $seller, SafeDealStatus::Shipped);

        $this->actingAs($seller, 'sanctum')
            ->postJson("/api/v1/safe-deals/{$deal->uuid}/confirm", [])
            ->assertForbidden();
    }
}

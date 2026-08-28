<?php

namespace Tests\Feature;

use App\Enums\SafeDealGatewayContour;
use App\Enums\SafeDealIncomingStatus;
use App\Enums\SafeDealPayoutChannel;
use App\Enums\SafeDealPayoutStatus;
use App\Enums\SafeDealStatus;
use App\Enums\UserStatus;
use App\Models\SafeDeal;
use App\Models\SafeDealGatewayEvent;
use App\Models\SafeDealIncomingPayment;
use App\Models\SafeDealPayout;
use App\Models\User;
use App\Models\UserPayoutRequisites;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SafeDealVtbSettlementModelsTest extends TestCase
{
    use RefreshDatabase;

    public function test_incoming_rbs_payment_moves_from_authorized_to_captured(): void
    {
        [$buyer, $seller, $deal] = $this->deal();

        $incoming = SafeDealIncomingPayment::query()->create([
            'safe_deal_id' => $deal->id,
            'buyer_id' => $buyer->id,
            'amount_kopecks' => 105_000,
            'capture_mode' => SafeDealIncomingPayment::CAPTURE_TWO_STAGE,
            'rbs_order_number' => $deal->uuid,
            'checkout_url' => 'https://vtb.rbsuat.com/payment/merchants/test/payment_ru.html?mdOrder=abc',
        ]);

        $incoming->applyRbsOrderStatus(1);
        $incoming->save();
        $incoming->refresh();

        $this->assertSame(SafeDealIncomingStatus::Authorized, $incoming->status);
        $this->assertNotNull($incoming->authorized_at);
        $this->assertFalse($incoming->status->fundsOnSettlementAccount());

        $incoming->rbs_order_id = 'md-order-1';
        $incoming->applyRbsOrderStatus(2);
        $incoming->save();
        $incoming->refresh();

        $this->assertSame(SafeDealIncomingStatus::Captured, $incoming->status);
        $this->assertTrue($incoming->status->fundsOnSettlementAccount());
        $this->assertTrue($incoming->isTwoStage());
        $this->assertTrue($deal->incomingPayments()->whereKey($incoming->id)->exists());
        $this->assertSame($incoming->id, $deal->latestIncomingPayment()->value('id'));
        $this->assertSame($buyer->id, $incoming->buyer_id);
        $this->assertSame($seller->id, $deal->seller_id);
    }

    public function test_sbp_and_card_payouts_and_gateway_callbacks(): void
    {
        [$buyer, $seller, $deal] = $this->deal();

        $sbp = SafeDealPayout::query()->create([
            'safe_deal_id' => $deal->id,
            'seller_id' => $seller->id,
            'channel' => SafeDealPayoutChannel::Sbp,
            'amount_kopecks' => 95_000,
            'request_id' => 'sbp-'.$deal->uuid,
            'sbp_phone' => '79119992211',
            'sbp_bank_id' => '100000000005',
            'sbp_full_name' => 'Иванов Иван Иванович',
            'payment_purpose' => 'Выплата по безопасной сделке',
        ]);

        $sbp->applyBankStatus('PROCESSING');
        $sbp->save();
        $this->assertSame(SafeDealPayoutStatus::Processing, $sbp->fresh()->status);

        $sbp->applyBankStatus('APPROVED');
        $sbp->sbp_pam = 'PAM-TEST';
        $sbp->save();
        $this->assertTrue($sbp->fresh()->status->canConfirm());

        $sbp->applyBankStatus('PAID');
        $sbp->operation_id = 'NSPK-OP-1';
        $sbp->save();
        $sbp->refresh();

        $this->assertSame(SafeDealPayoutStatus::Paid, $sbp->status);
        $this->assertTrue($sbp->status->isTerminal());
        $this->assertSame('79119992211', $sbp->sbp_phone);
        $this->assertNotSame('79119992211', $sbp->getRawOriginal('sbp_phone'));

        $card = SafeDealPayout::query()->create([
            'safe_deal_id' => $deal->id,
            'seller_id' => $seller->id,
            'channel' => SafeDealPayoutChannel::Card,
            'amount_kopecks' => 95_000,
            'request_id' => 'a2c-'.$deal->uuid,
            'card_last4' => '1111',
            'provider_order_id' => 'TRANSFER000001',
        ]);
        $card->applyBankStatus('SUCCESS');
        $card->save();
        $this->assertSame(SafeDealPayoutStatus::Paid, $card->fresh()->status);

        SafeDealGatewayEvent::query()->create([
            'contour' => SafeDealGatewayContour::Ie,
            'event_type' => SafeDealGatewayEvent::TYPE_RBS_CALLBACK,
            'safe_deal_id' => $deal->id,
            'idempotency_key' => 'md-order-ie-1',
            'payload' => ['mdOrder' => 'md-order-ie-1', 'operation' => 'deposited'],
            'processed_at' => now(),
        ]);

        SafeDealGatewayEvent::query()->create([
            'contour' => SafeDealGatewayContour::Oe,
            'event_type' => SafeDealGatewayEvent::TYPE_SBP_FINAL,
            'safe_deal_id' => $deal->id,
            'payout_id' => $sbp->id,
            'idempotency_key' => $sbp->request_id,
            'payload' => ['type' => 'SBP_B2C_PAYMENT_FINAL', 'transactionStatus' => 'PAID'],
            'processed_at' => now(),
        ]);

        $this->assertSame(2, $deal->gatewayEvents()->count());
        $this->assertSame(2, $deal->payouts()->count());
        $this->assertSame($buyer->id, $deal->buyer_id);
    }

    public function test_seller_requisites_store_sbp_phone_encrypted(): void
    {
        $seller = User::factory()->create(['status' => UserStatus::Active]);

        $row = UserPayoutRequisites::query()->create([
            'user_id' => $seller->id,
            'preferred_channel' => 'sbp',
            'sbp_phone' => '79001234567',
            'sbp_bank_id' => '100000000005',
            'sbp_bank_name' => 'ВТБ',
            'sbp_full_name' => 'Петров Пётр',
            'card_last4' => '4242',
        ]);

        $this->assertSame('79001234567', $row->fresh()->sbp_phone);
        $this->assertNotSame('79001234567', $row->getRawOriginal('sbp_phone'));
        $this->assertTrue($seller->payoutRequisites()->exists());
        $this->assertArrayNotHasKey('sbp_phone', $row->fresh()->toArray());
    }

    /** @return array{0: User, 1: User, 2: SafeDeal} */
    private function deal(): array
    {
        $buyer = User::factory()->create(['status' => UserStatus::Active]);
        $seller = User::factory()->create(['status' => UserStatus::Active]);
        $deal = SafeDeal::query()->create([
            'buyer_id' => $buyer->id,
            'seller_id' => $seller->id,
            'amount_kopecks' => 105_000,
            'platform_fee_kopecks' => 5_000,
            'seller_payout_kopecks' => 95_000,
            'delivery_cost_kopecks' => 5_000,
            'status' => SafeDealStatus::Paid,
            'paid_at' => now(),
        ]);

        return [$buyer, $seller, $deal];
    }
}

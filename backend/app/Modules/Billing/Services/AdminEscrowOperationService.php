<?php

namespace Modules\Billing\Services;

use App\Enums\EscrowDealStatus;
use App\Enums\EscrowOperationType;
use App\Models\EscrowDeal;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Validation\ValidationException;
use Modules\Billing\Clients\VtbAcquiringClient;
use RuntimeException;

class AdminEscrowOperationService
{
    public function __construct(
        private readonly VtbAcquiringClient $vtb,
        private readonly EscrowOperationRecorder $recorder,
    ) {}

    public function sync(User $admin, EscrowDeal $deal, ?string $idempotencyKey = null): EscrowDeal
    {
        $this->assertVtbDeal($deal);
        $orderId = $this->vtbOrderId($deal);

        $op = $this->recorder->start(
            $deal,
            EscrowOperationType::Sync,
            'admin',
            $admin,
            idempotencyKey: $idempotencyKey,
        );

        try {
            $status = $this->vtb->getOrderStatusExtended($orderId);
            $deal->update(['vtb_payment_state' => (string) ($status['orderStatus'] ?? '')]);
            $this->applyVtbStatus($deal, $status);
            $this->recorder->succeed($op, $orderId, $status);
        } catch (\Throwable $e) {
            $this->recorder->fail($op, $e->getMessage());
            throw ValidationException::withMessages(['escrow' => [$e->getMessage()]]);
        }

        return $deal->fresh(['listing', 'buyer.profile', 'seller.profile', 'shipment', 'payment', 'operations']);
    }

    public function capture(User $admin, EscrowDeal $deal, ?int $amountCents, string $reason, ?string $idempotencyKey = null): EscrowDeal
    {
        $this->assertNotFrozen($deal);
        $this->assertVtbDeal($deal);

        if (! $deal->status->allowsCapture()) {
            throw ValidationException::withMessages(['escrow' => ['Списание недоступно в текущем статусе.']]);
        }

        $orderId = $this->vtbOrderId($deal);
        $amount = $amountCents ?? $deal->remainingCaptureCents();

        if ($amount <= 0) {
            throw ValidationException::withMessages(['amount_cents' => ['Нет суммы для списания.']]);
        }

        $op = $this->recorder->start(
            $deal,
            EscrowOperationType::Capture,
            'admin',
            $admin,
            $amount,
            $reason,
            ['amount_cents' => $amount],
            $idempotencyKey,
        );

        try {
            $response = $this->vtb->depositOrder($orderId, $amount);
            $deal->update([
                'captured_cents' => $deal->captured_cents + $amount,
                'status' => EscrowDealStatus::Captured,
                'vtb_payment_state' => '2',
            ]);
            $this->recorder->succeed($op, $orderId, $response);
        } catch (\Throwable $e) {
            $this->recorder->fail($op, $e->getMessage());
            throw ValidationException::withMessages(['escrow' => [$e->getMessage()]]);
        }

        return $deal->fresh(['listing', 'buyer.profile', 'seller.profile', 'shipment', 'payment', 'operations']);
    }

    public function reverse(User $admin, EscrowDeal $deal, string $reason, ?string $idempotencyKey = null): EscrowDeal
    {
        $this->assertVtbDeal($deal);

        if ($deal->captured_cents > 0) {
            throw ValidationException::withMessages(['escrow' => ['Холд уже списан — используйте возврат.']]);
        }

        $orderId = $this->vtbOrderId($deal);
        $op = $this->recorder->start(
            $deal,
            EscrowOperationType::Reverse,
            'admin',
            $admin,
            $deal->amount_cents,
            $reason,
            idempotencyKey: $idempotencyKey,
        );

        try {
            $response = $this->vtb->reverseOrder($orderId);
            $deal->update([
                'status' => EscrowDealStatus::Reversed,
                'vtb_payment_state' => '3',
            ]);
            $this->recorder->succeed($op, $orderId, $response);
        } catch (\Throwable $e) {
            $this->recorder->fail($op, $e->getMessage());
            throw ValidationException::withMessages(['escrow' => [$e->getMessage()]]);
        }

        return $deal->fresh(['listing', 'buyer.profile', 'seller.profile', 'shipment', 'payment', 'operations']);
    }

    public function refund(User $admin, EscrowDeal $deal, int $amountCents, string $reason, ?string $idempotencyKey = null): EscrowDeal
    {
        $this->assertNotFrozen($deal);
        $this->assertVtbDeal($deal);

        if ($deal->captured_cents <= 0) {
            throw ValidationException::withMessages(['escrow' => ['Возврат возможен только после списания.']]);
        }

        $maxRefund = $deal->captured_cents - $deal->refunded_cents;
        if ($amountCents <= 0 || $amountCents > $maxRefund) {
            throw ValidationException::withMessages(['amount_cents' => ["Максимум к возврату: {$maxRefund} коп."]]);
        }

        $orderId = $this->vtbOrderId($deal);
        $op = $this->recorder->start(
            $deal,
            EscrowOperationType::Refund,
            'admin',
            $admin,
            $amountCents,
            $reason,
            ['amount_cents' => $amountCents],
            $idempotencyKey,
        );

        try {
            $response = $this->vtb->refundOrder($orderId, $amountCents);
            $newRefunded = $deal->refunded_cents + $amountCents;
            $deal->update([
                'refunded_cents' => $newRefunded,
                'status' => $newRefunded >= $deal->captured_cents
                    ? EscrowDealStatus::Refunded
                    : EscrowDealStatus::Refunding,
            ]);
            $this->recorder->succeed($op, $orderId, $response);
        } catch (\Throwable $e) {
            $this->recorder->fail($op, $e->getMessage());
            throw ValidationException::withMessages(['escrow' => [$e->getMessage()]]);
        }

        return $deal->fresh(['listing', 'buyer.profile', 'seller.profile', 'shipment', 'payment', 'operations']);
    }

    public function payout(User $admin, EscrowDeal $deal, ?int $amountCents, string $reason, ?string $idempotencyKey = null): EscrowDeal
    {
        $this->assertNotFrozen($deal);

        if ($deal->captured_cents <= 0) {
            throw ValidationException::withMessages(['escrow' => ['Выплата после списания средств.']]);
        }

        $amount = $amountCents ?? min($deal->remainingPayoutCents(), $deal->seller_payout_cents - $deal->paid_out_cents);
        $amount = min($amount, $deal->remainingPayoutCents());

        if ($amount <= 0) {
            throw ValidationException::withMessages(['amount_cents' => ['Нет суммы к выплате.']]);
        }

        $op = $this->recorder->start(
            $deal,
            EscrowOperationType::Payout,
            'admin',
            $admin,
            $amount,
            $reason,
            ['amount_cents' => $amount, 'manual' => true],
            $idempotencyKey,
        );

        // Bank payout API — отдельный контур; админ фиксирует ручной перевод.
        $deal->update([
            'paid_out_cents' => $deal->paid_out_cents + $amount,
            'status' => ($deal->paid_out_cents + $amount) >= $deal->seller_payout_cents
                ? EscrowDealStatus::Completed
                : EscrowDealStatus::PayoutPending,
            'completed_at' => ($deal->paid_out_cents + $amount) >= $deal->seller_payout_cents ? now() : $deal->completed_at,
        ]);
        $this->recorder->succeed($op, 'manual-'.now()->timestamp, ['note' => 'Manual payout recorded by admin']);

        return $deal->fresh(['listing', 'buyer.profile', 'seller.profile', 'shipment', 'payment', 'operations']);
    }

    public function freeze(User $admin, EscrowDeal $deal, string $reason, ?string $idempotencyKey = null): EscrowDeal
    {
        if ($deal->status->isTerminal()) {
            throw ValidationException::withMessages(['escrow' => ['Сделка уже завершена.']]);
        }

        $op = $this->recorder->start(
            $deal,
            EscrowOperationType::Freeze,
            'admin',
            $admin,
            reason: $reason,
            idempotencyKey: $idempotencyKey,
        );

        $deal->update([
            'frozen_at' => now(),
            'freeze_reason' => $reason,
            'status' => EscrowDealStatus::Frozen,
        ]);
        $this->recorder->succeed($op);

        return $deal->fresh(['listing', 'buyer.profile', 'seller.profile', 'shipment', 'payment', 'operations']);
    }

    public function unfreeze(User $admin, EscrowDeal $deal, string $reason, ?string $idempotencyKey = null): EscrowDeal
    {
        if (! $deal->isFrozen()) {
            throw ValidationException::withMessages(['escrow' => ['Сделка не заморожена.']]);
        }

        $op = $this->recorder->start(
            $deal,
            EscrowOperationType::Unfreeze,
            'admin',
            $admin,
            reason: $reason,
            idempotencyKey: $idempotencyKey,
        );

        $restore = match (true) {
            $deal->captured_cents > 0 && $deal->paid_out_cents >= $deal->seller_payout_cents => EscrowDealStatus::Completed,
            $deal->captured_cents > 0 => EscrowDealStatus::Captured,
            $deal->paid_at !== null => EscrowDealStatus::Funded,
            default => EscrowDealStatus::PendingPayment,
        };

        $deal->update([
            'frozen_at' => null,
            'freeze_reason' => null,
            'dispute_status' => 'none',
            'status' => $restore,
        ]);
        $this->recorder->succeed($op);

        return $deal->fresh(['listing', 'buyer.profile', 'seller.profile', 'shipment', 'payment', 'operations']);
    }

    public function cancel(User $admin, EscrowDeal $deal, string $reason, ?string $idempotencyKey = null): EscrowDeal
    {
        if ($deal->status->isTerminal()) {
            throw ValidationException::withMessages(['escrow' => ['Сделка уже завершена.']]);
        }

        if ($deal->payment_provider === 'vtb' && $deal->captured_cents === 0 && $deal->paid_at !== null) {
            return $this->reverse($admin, $deal, $reason, $idempotencyKey);
        }

        $op = $this->recorder->start(
            $deal,
            EscrowOperationType::Cancel,
            'admin',
            $admin,
            reason: $reason,
            idempotencyKey: $idempotencyKey,
        );

        $deal->update(['status' => EscrowDealStatus::Cancelled]);
        $this->recorder->succeed($op);

        return $deal->fresh(['listing', 'buyer.profile', 'seller.profile', 'shipment', 'payment', 'operations']);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function resolveDispute(User $admin, EscrowDeal $deal, array $data, ?string $idempotencyKey = null): EscrowDeal
    {
        if ($deal->dispute_status !== 'open') {
            throw ValidationException::withMessages(['escrow' => ['Спор не открыт.']]);
        }

        $outcome = (string) ($data['outcome'] ?? '');
        $note = (string) ($data['note'] ?? '');

        $op = $this->recorder->start(
            $deal,
            EscrowOperationType::DisputeResolve,
            'admin',
            $admin,
            reason: $note,
            request: $data,
            idempotencyKey: $idempotencyKey,
        );

        match ($outcome) {
            'buyer' => $this->refund(
                $admin,
                $deal->fresh(),
                (int) ($data['buyer_amount_cents'] ?? $deal->captured_cents),
                $note ?: 'Спор: в пользу покупателя',
                $idempotencyKey ? $idempotencyKey.'-refund' : null,
            ),
            'seller' => $this->capture($admin, $deal->fresh(), null, $note ?: 'Спор: в пользу продавца', $idempotencyKey ? $idempotencyKey.'-cap' : null),
            'split' => $this->resolveSplit($admin, $deal->fresh(), $data, $note, $idempotencyKey),
            default => throw ValidationException::withMessages(['outcome' => ['Укажите outcome: buyer, seller или split.']]),
        };

        $deal->refresh()->update(['dispute_status' => 'resolved']);
        $this->recorder->succeed($op);

        return $deal->fresh(['listing', 'buyer.profile', 'seller.profile', 'shipment', 'payment', 'operations']);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function resolveSplit(User $admin, EscrowDeal $deal, array $data, string $note, ?string $idempotencyKey): void
    {
        $refundCents = (int) ($data['buyer_amount_cents'] ?? 0);
        $payoutCents = (int) ($data['seller_amount_cents'] ?? 0);

        if ($refundCents > 0) {
            $this->refund($admin, $deal, $refundCents, $note, $idempotencyKey ? $idempotencyKey.'-r' : null);
            $deal->refresh();
        }

        if ($deal->captured_cents === 0 && $payoutCents > 0) {
            $this->capture($admin, $deal, null, $note, $idempotencyKey ? $idempotencyKey.'-c' : null);
            $deal->refresh();
        }

        if ($payoutCents > 0) {
            $this->payout($admin, $deal, $payoutCents, $note, $idempotencyKey ? $idempotencyKey.'-p' : null);
        }
    }

    /**
     * @param  array<string, mixed>  $status
     */
    private function applyVtbStatus(EscrowDeal $deal, array $status): void
    {
        if (VtbAcquiringClient::isDeposited($status) && $deal->status !== EscrowDealStatus::Captured) {
            $deal->update([
                'status' => EscrowDealStatus::Captured,
                'captured_cents' => $deal->amount_cents,
                'paid_at' => $deal->paid_at ?? now(),
            ]);

            return;
        }

        if (VtbAcquiringClient::isAuthorizedHold($status) && $deal->status === EscrowDealStatus::PendingPayment) {
            $deal->update([
                'status' => EscrowDealStatus::Funded,
                'paid_at' => now(),
            ]);

            return;
        }

        if (VtbAcquiringClient::isReversed($status)) {
            $deal->update(['status' => EscrowDealStatus::Reversed]);
        }
    }

    private function assertVtbDeal(EscrowDeal $deal): void
    {
        if ($deal->payment_provider !== 'vtb') {
            throw ValidationException::withMessages(['escrow' => ['Операция ВТБ недоступна для этого провайдера.']]);
        }
    }

    private function assertNotFrozen(EscrowDeal $deal): void
    {
        if ($deal->isFrozen()) {
            throw ValidationException::withMessages(['escrow' => ['Сделка заморожена. Сначала разморозьте.']]);
        }
    }

    private function vtbOrderId(EscrowDeal $deal): string
    {
        $orderId = $deal->vtb_order_id
            ?? $deal->payment?->provider_payment_id;

        if (! $orderId) {
            throw new RuntimeException('Нет идентификатора заказа ВТБ.');
        }

        return (string) $orderId;
    }
}

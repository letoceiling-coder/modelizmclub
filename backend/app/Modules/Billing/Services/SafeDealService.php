<?php

namespace Modules\Billing\Services;

use App\Enums\DisputeStatus;
use App\Enums\ListingStatus;
use App\Enums\SafeDealStatus;
use App\Enums\WalletTransactionType;
use App\Models\Dispute;
use App\Models\EscrowTransaction;
use App\Models\Listing;
use App\Models\SafeDeal;
use App\Models\SystemSetting;
use App\Models\User;
use App\Notifications\InAppNotification;
use App\Services\InAppNotify;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Modules\Billing\Exceptions\InsufficientFundsException;

/**
 * Wallet-based safe deal (escrow) service (spec v4.0 §T5).
 *
 * Money never leaves the internal wallet ledger: the buyer's balance is held
 * on creation and released to the seller (minus platform commission) on
 * completion, or refunded on cancellation / dispute.
 */
class SafeDealService
{
    public function __construct(private readonly WalletService $wallet) {}

    public function platformFeePercent(): float
    {
        $value = SystemSetting::query()->where('key', 'safe_deal.platform_fee_percent')->value('value');

        if (is_array($value) && isset($value['percent'])) {
            return max(0.0, (float) $value['percent']);
        }

        return (float) config('billing.safe_deal.platform_fee_percent', 5);
    }

    /** Days after delivery before funds auto-release to the seller. */
    public function autoReleaseDays(): int
    {
        $value = SystemSetting::query()->where('key', 'safe_deal.auto_release_days')->value('value');

        if (is_array($value) && isset($value['days'])) {
            return max(1, (int) $value['days']);
        }

        return (int) config('billing.safe_deal.auto_release_days', 7);
    }

    public function create(User $buyer, Listing $listing): SafeDeal
    {
        if ($listing->status !== ListingStatus::Published) {
            throw ValidationException::withMessages(['listing' => ['Объявление недоступно для покупки.']]);
        }

        if ((int) $listing->price_cents <= 0) {
            throw ValidationException::withMessages(['listing' => ['У объявления не указана цена.']]);
        }

        if ((int) $listing->user_id === (int) $buyer->id) {
            throw ValidationException::withMessages(['listing' => ['Нельзя купить собственное объявление.']]);
        }

        $amount = (int) $listing->price_cents;
        $fee = (int) round($amount * $this->platformFeePercent() / 100);
        $payout = $amount - $fee;

        if ($payout <= 0) {
            throw ValidationException::withMessages(['listing' => ['Сумма слишком мала для безопасной сделки.']]);
        }

        try {
            return DB::transaction(function () use ($buyer, $listing, $amount, $fee, $payout): SafeDeal {
                $deal = SafeDeal::query()->create([
                    'uuid' => (string) Str::uuid(),
                    'listing_id' => $listing->id,
                    'buyer_id' => $buyer->id,
                    'seller_id' => $listing->user_id,
                    'amount_kopecks' => $amount,
                    'platform_fee_kopecks' => $fee,
                    'seller_payout_kopecks' => $payout,
                    'currency' => $listing->currency ?? 'RUB',
                    'status' => SafeDealStatus::Paid,
                    'paid_at' => now(),
                ]);

                $hold = $this->wallet->hold(
                    $buyer,
                    $amount,
                    WalletTransactionType::SafeDealHold,
                    "Холд по сделке {$deal->uuid}",
                    'safe_deal',
                    $deal->id,
                    'safe-deal-hold:'.$deal->id,
                );

                $deal->update(['hold_transaction_id' => $hold->id]);
                $this->log($deal, $buyer, 'paid', $amount, $hold->id, 'Средства заблокированы на балансе покупателя.');

                $fresh = $deal->fresh();
                $this->notifyDeal($fresh, $fresh?->seller_id, 'Новая безопасная сделка', 'Покупатель оплатил объявление.');

                return $fresh;
            });
        } catch (InsufficientFundsException $e) {
            throw ValidationException::withMessages(['balance' => [$e->getMessage()]]);
        }
    }

    public function ship(User $seller, SafeDeal $deal, ?string $trackingNumber, ?string $method): SafeDeal
    {
        $this->assertParticipant($deal, $seller, 'seller');

        if ($deal->status !== SafeDealStatus::Paid) {
            throw ValidationException::withMessages(['deal' => ['Отправить можно только оплаченную сделку.']]);
        }

        $deal->update([
            'status' => SafeDealStatus::Shipped,
            'shipped_at' => now(),
            'tracking_number' => $trackingNumber,
            'delivery_method' => $method,
        ]);

        $this->log($deal, $seller, 'shipped', null, null, 'Продавец отметил отправку.');

        $fresh = $deal->fresh();
        $this->notifyDeal($fresh, $fresh?->buyer_id, 'Заказ отправлен', $trackingNumber ? 'Трек-номер: '.$trackingNumber : '');

        return $fresh;
    }

    public function markDelivered(SafeDeal $deal, ?User $actor = null, string $note = 'Отмечено доставленным.'): SafeDeal
    {
        if (! in_array($deal->status, [SafeDealStatus::Paid, SafeDealStatus::Shipped], true)) {
            return $deal;
        }

        $deal->update([
            'status' => SafeDealStatus::Delivered,
            'delivered_at' => now(),
            'auto_release_at' => now()->addDays($this->autoReleaseDays()),
        ]);

        $this->log($deal, $actor, 'delivered', null, null, $note);

        $fresh = $deal->fresh();
        $this->notifyDeal($fresh, $fresh?->buyer_id, 'Заказ доставлен', 'Подтвердите получение, чтобы продавец получил оплату.');
        $this->notifyDeal($fresh, $fresh?->seller_id, 'Заказ отмечен доставленным', '');

        return $fresh;
    }

    /** Buyer confirms receipt → release held funds to the seller. */
    public function confirm(User $buyer, SafeDeal $deal): SafeDeal
    {
        $this->assertParticipant($deal, $buyer, 'buyer');

        if (! in_array($deal->status, [SafeDealStatus::Paid, SafeDealStatus::Shipped, SafeDealStatus::Delivered], true)) {
            throw ValidationException::withMessages(['deal' => ['Сделку нельзя завершить в текущем статусе.']]);
        }

        return $this->releaseToSeller($deal, $buyer, 'Покупатель подтвердил получение.');
    }

    /** Scheduled auto-release for delivered deals past their window. */
    public function autoRelease(SafeDeal $deal): SafeDeal
    {
        if ($deal->status !== SafeDealStatus::Delivered) {
            return $deal;
        }

        return $this->releaseToSeller($deal, null, 'Автоматическое подтверждение по истечении срока.');
    }

    public function cancel(User $actor, SafeDeal $deal): SafeDeal
    {
        if (! $deal->involves($actor) && ! $actor->isModerator()) {
            throw ValidationException::withMessages(['deal' => ['Нет доступа к сделке.']]);
        }

        if (! in_array($deal->status, [SafeDealStatus::Paid, SafeDealStatus::Shipped], true)) {
            throw ValidationException::withMessages(['deal' => ['Отменить можно только неотправленную/недоставленную сделку.']]);
        }

        return $this->refundBuyer($deal, $actor, SafeDealStatus::Cancelled, 'Сделка отменена, средства возвращены покупателю.');
    }

    public function openDispute(User $user, SafeDeal $deal, string $reason, ?string $description): Dispute
    {
        $this->assertParticipant($deal, $user, 'any');

        if (! in_array($deal->status, [SafeDealStatus::Paid, SafeDealStatus::Shipped, SafeDealStatus::Delivered], true)) {
            throw ValidationException::withMessages(['deal' => ['Спор можно открыть только по активной сделке.']]);
        }

        if ($deal->status === SafeDealStatus::Disputed) {
            throw ValidationException::withMessages(['deal' => ['Спор по этой сделке уже открыт.']]);
        }

        $dispute = DB::transaction(function () use ($user, $deal, $reason, $description): Dispute {
            $previousStatus = $deal->status->value;

            $deal->update([
                'status' => SafeDealStatus::Disputed,
                'metadata' => array_merge($deal->metadata ?? [], ['pre_dispute_status' => $previousStatus]),
            ]);

            $dispute = Dispute::query()->create([
                'uuid' => (string) Str::uuid(),
                'safe_deal_id' => $deal->id,
                'opened_by' => $user->id,
                'reason' => $reason,
                'description' => $description,
                'status' => DisputeStatus::Open,
            ]);

            $this->log($deal, $user, 'disputed', null, null, "Открыт спор: {$reason}");

            return $dispute;
        });

        $fresh = $deal->fresh() ?? $deal;
        $otherId = (int) $user->id === (int) $fresh->buyer_id ? $fresh->seller_id : $fresh->buyer_id;
        $this->notifyDeal($fresh, $otherId, 'Открыт спор по сделке', $reason);

        return $dispute;
    }

    public function resolveDispute(User $admin, Dispute $dispute, string $inFavorOf, ?string $resolution): Dispute
    {
        if ($dispute->status !== DisputeStatus::Open) {
            throw ValidationException::withMessages(['dispute' => ['Спор уже закрыт.']]);
        }

        $deal = $dispute->safeDeal;

        return DB::transaction(function () use ($admin, $dispute, $deal, $inFavorOf, $resolution): Dispute {
            if ($inFavorOf === 'buyer') {
                $this->refundBuyer($deal, $admin, SafeDealStatus::Refunded, 'Спор решён в пользу покупателя.');
                $dispute->status = DisputeStatus::ResolvedBuyer;
            } else {
                $this->releaseToSeller($deal, $admin, 'Спор решён в пользу продавца.');
                $dispute->status = DisputeStatus::ResolvedSeller;
            }

            $dispute->resolution = $resolution;
            $dispute->resolved_by = $admin->id;
            $dispute->resolved_at = now();
            $dispute->save();

            return $dispute->fresh();
        });
    }

    private function releaseToSeller(SafeDeal $deal, ?User $actor, string $note): SafeDeal
    {
        return DB::transaction(function () use ($deal, $actor, $note): SafeDeal {
            $buyer = $deal->buyer;
            $seller = $deal->seller;

            $this->wallet->consumeHold($buyer, (int) $deal->amount_kopecks);

            $payout = $this->wallet->credit(
                $seller,
                (int) $deal->seller_payout_kopecks,
                WalletTransactionType::SafeDealPayout,
                "Выплата по сделке {$deal->uuid}",
                'safe_deal',
                $deal->id,
                'safe-deal-payout:'.$deal->id,
            );

            $deal->update([
                'status' => SafeDealStatus::Completed,
                'completed_at' => now(),
                'payout_transaction_id' => $payout->id,
            ]);

            $this->log($deal, $actor, 'completed', (int) $deal->seller_payout_kopecks, $payout->id, $note);

            if ((int) $deal->platform_fee_kopecks > 0) {
                $this->log($deal, null, 'commission', (int) $deal->platform_fee_kopecks, null, 'Комиссия платформы удержана.');
            }

            $fresh = $deal->fresh();
            $this->notifyDeal($fresh, $fresh?->seller_id, 'Сделка завершена', 'Средства переведены на ваш баланс.');
            $this->notifyDeal($fresh, $fresh?->buyer_id, 'Сделка завершена', '');

            return $fresh;
        });
    }

    private function refundBuyer(SafeDeal $deal, ?User $actor, SafeDealStatus $finalStatus, string $note): SafeDeal
    {
        return DB::transaction(function () use ($deal, $actor, $finalStatus, $note): SafeDeal {
            $refund = $this->wallet->refundHold(
                $deal->buyer,
                (int) $deal->amount_kopecks,
                WalletTransactionType::SafeDealRefund,
                "Возврат по сделке {$deal->uuid}",
                'safe_deal',
                $deal->id,
                'safe-deal-refund:'.$deal->id,
            );

            $deal->update([
                'status' => $finalStatus,
                'cancelled_at' => now(),
                'refund_transaction_id' => $refund->id,
            ]);

            $this->log($deal, $actor, $finalStatus->value, (int) $deal->amount_kopecks, $refund->id, $note);

            $fresh = $deal->fresh();
            $this->notifyDeal($fresh, $fresh?->buyer_id, 'Сделка отменена', 'Средства возвращены на баланс.');
            $this->notifyDeal($fresh, $fresh?->seller_id, 'Сделка отменена', $note);

            return $fresh;
        });
    }

    private function notifyDeal(?SafeDeal $deal, mixed $userId, string $title, string $body): void
    {
        $id = is_numeric($userId) ? (int) $userId : 0;
        if ($id <= 0 || $deal === null) {
            return;
        }

        $user = User::query()->find($id);
        if (! $user) {
            return;
        }

        InAppNotify::sendQuiet(
            $user,
            new InAppNotification('deals', $title, $body, "/deals/{$deal->uuid}"),
        );
    }

    private function assertParticipant(SafeDeal $deal, User $user, string $role): void
    {
        $ok = match ($role) {
            'buyer' => (int) $deal->buyer_id === (int) $user->id,
            'seller' => (int) $deal->seller_id === (int) $user->id,
            default => $deal->involves($user),
        };

        if (! $ok && ! $user->isModerator()) {
            throw ValidationException::withMessages(['deal' => ['Нет доступа к сделке.']]);
        }
    }

    private function log(SafeDeal $deal, ?User $actor, string $type, ?int $amount, ?int $walletTxId, string $note): void
    {
        EscrowTransaction::query()->create([
            'safe_deal_id' => $deal->id,
            'actor_id' => $actor?->id,
            'type' => $type,
            'amount_kopecks' => $amount,
            'wallet_transaction_id' => $walletTxId,
            'note' => $note,
            'created_at' => now(),
        ]);
    }

    /** @return array<string, mixed> */
    public function toArray(SafeDeal $deal): array
    {
        return [
            'uuid' => $deal->uuid,
            'listing_uuid' => $deal->listing?->uuid,
            'status' => $deal->status->value,
            'status_label' => $deal->status->label(),
            'amount_kopecks' => (int) $deal->amount_kopecks,
            'platform_fee_kopecks' => (int) $deal->platform_fee_kopecks,
            'seller_payout_kopecks' => (int) $deal->seller_payout_kopecks,
            'currency' => $deal->currency,
            'tracking_number' => $deal->tracking_number,
            'delivery_method' => $deal->delivery_method,
            'paid_at' => $deal->paid_at?->toIso8601String(),
            'shipped_at' => $deal->shipped_at?->toIso8601String(),
            'delivered_at' => $deal->delivered_at?->toIso8601String(),
            'completed_at' => $deal->completed_at?->toIso8601String(),
            'auto_release_at' => $deal->auto_release_at?->toIso8601String(),
        ];
    }
}

<?php

namespace Modules\Billing\Services;

use App\Enums\DeliveryCarrier;
use App\Enums\DisputeStatus;
use App\Enums\ListingStatus;
use App\Enums\SafeDealIncomingStatus;
use App\Enums\SafeDealStatus;
use App\Enums\ShipmentStatus;
use App\Enums\WalletTransactionType;
use App\Models\Dispute;
use App\Models\EscrowTransaction;
use App\Models\Listing;
use App\Models\Media;
use App\Models\SafeDeal;
use App\Models\SafeDealIncomingPayment;
use App\Models\SellerDeliveryProfile;
use App\Models\Shipment;
use App\Models\SystemSetting;
use App\Models\User;
use App\Models\UserReview;
use App\Notifications\InAppNotification;
use App\Services\InAppNotify;
use App\Services\NotificationPolicy;
use App\Support\ParcelSize;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Modules\Billing\Exceptions\InsufficientFundsException;
use Modules\Billing\Notifications\SafeDealStatusNotification;
use Modules\Delivery\Services\Carriers\CdekDeliveryAdapter;
use Modules\Delivery\Services\CdekApiExtension;
use Modules\Delivery\Services\SellerDeliveryProfileService;
use Modules\Delivery\Services\ShipmentService;
use Modules\User\Services\UserRatingService;
use RuntimeException;
use Throwable;

/**
 * Wallet-based safe deal (escrow) service (spec v4.0 §T5).
 *
 * Money never leaves the internal wallet ledger: the buyer's balance is held
 * on creation and released to the seller (minus platform commission) on
 * completion, or refunded on cancellation / dispute.
 */
class SafeDealService
{
    public function __construct(
        private readonly WalletService $wallet,
        private readonly UserRatingService $ratings,
        private readonly SafeDealSettlementService $settlement,
        private readonly SafeDealPayoutService $payouts,
        private readonly SafeDealChatService $dealChat,
    ) {}

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

    /** Days after payment during which a dispute can be opened. */
    public function holdDays(): int
    {
        return max(1, (int) config('billing.safe_deal.hold_days', 14));
    }

    /**
     * @param  array<string, mixed>  $destination
     * @return array<string, mixed>
     */
    public function quoteForListing(Listing $listing, array $destination = []): array
    {
        $this->assertPurchasable($listing);

        $item = (int) $listing->price_cents;
        $feePercent = $this->platformFeePercent();
        $fee = (int) round($item * $feePercent / 100);
        $parcel = ParcelSize::fromListing($listing);
        $offersCdek = ParcelSize::offersCdek($listing->delivery_methods ?? []);

        $delivery = 0;
        $origin = null;
        $tariff = null;
        $destinationPoint = $this->normalizeDestination($destination);

        if ($offersCdek) {
            if ($destinationPoint === null) {
                throw ValidationException::withMessages([
                    'destination_point' => ['Выберите пункт выдачи СДЭК.'],
                ]);
            }
            $quoted = $this->quoteCdekDelivery($listing, $destinationPoint, $parcel);
            $delivery = (int) $quoted['price_cents'];
            $origin = $quoted['origin'];
            $tariff = $quoted['tariff_code'];
        }

        return [
            'item_kopecks' => $item,
            'platform_fee_percent' => $feePercent,
            'platform_fee_kopecks' => $fee,
            'delivery_cost_kopecks' => $delivery,
            'total_kopecks' => $item + $delivery,
            'hold_kopecks' => $item + $delivery,
            'seller_payout_kopecks' => $item - $fee,
            'currency' => $listing->currency ?? 'RUB',
            // Tells the checkout whether to promise a card hold or a charge.
            'escrow_holds_on_card' => ! $this->settlement->usesVtb() || $this->settlement->holdsOnCard(),
            'offers_cdek' => $offersCdek,
            'parcel' => $parcel,
            'origin' => $origin,
            'destination_point' => $destinationPoint,
            'tariff_code' => $tariff,
        ];
    }

    /**
     * @param  array<string, mixed>  $options
     */
    public function create(User $buyer, Listing $listing, array $options = []): SafeDeal
    {
        $this->assertPurchasable($listing, $buyer);

        $offersCdek = ParcelSize::offersCdek($listing->delivery_methods ?? []);
        $destination = $this->normalizeDestination(is_array($options['destination_point'] ?? null) ? $options['destination_point'] : []);

        if (! filter_var($options['accept_terms'] ?? false, FILTER_VALIDATE_BOOLEAN)) {
            throw ValidationException::withMessages([
                'accept_terms' => ['Нужно согласие с Правилами безопасной сделки.'],
            ]);
        }

        if ($offersCdek) {
            if ($destination === null) {
                throw ValidationException::withMessages([
                    'destination_point' => ['Выберите пункт выдачи СДЭК.'],
                ]);
            }
        }

        $quote = $this->quoteForListing($listing, $destination ?? []);
        $item = (int) $quote['item_kopecks'];
        $fee = (int) $quote['platform_fee_kopecks'];
        $delivery = (int) $quote['delivery_cost_kopecks'];
        $payout = (int) $quote['seller_payout_kopecks'];
        $holdAmount = (int) $quote['hold_kopecks'];

        if ($payout <= 0) {
            throw ValidationException::withMessages(['listing' => ['Сумма слишком мала для безопасной сделки.']]);
        }

        $vtb = $this->settlement->usesVtb();

        try {
            $deal = DB::transaction(function () use ($buyer, $listing, $item, $fee, $delivery, $payout, $holdAmount, $destination, $offersCdek, $quote, $vtb): SafeDeal {
                $deal = SafeDeal::query()->create([
                    'uuid' => (string) Str::uuid(),
                    'listing_id' => $listing->id,
                    'buyer_id' => $buyer->id,
                    'seller_id' => $listing->user_id,
                    'amount_kopecks' => $holdAmount,
                    'platform_fee_kopecks' => $fee,
                    'seller_payout_kopecks' => $payout,
                    'delivery_cost_kopecks' => $delivery,
                    'currency' => $listing->currency ?? 'RUB',
                    // A card hold only exists once the buyer passes 3-D Secure,
                    // so a VTB deal waits in `created` until VTB confirms it.
                    'status' => $vtb ? SafeDealStatus::Created : SafeDealStatus::Paid,
                    'paid_at' => $vtb ? null : now(),
                    'hold_expires_at' => $vtb ? null : now()->addDays($this->holdDays()),
                    'delivery_method' => $offersCdek ? 'СДЭК' : null,
                    'destination_point' => $destination,
                    'delivery_status' => $offersCdek ? 'pending' : null,
                    'metadata' => [
                        'item_kopecks' => $item,
                        'tariff_code' => $quote['tariff_code'] ?? null,
                        'escrow_provider' => $vtb ? SafeDealSettlementService::PROVIDER_VTB : SafeDealSettlementService::PROVIDER_WALLET,
                    ],
                ]);

                // Buyer and seller get their deal chat straight away, before any
                // money moves, so every later status lands in an existing thread.
                $this->dealChat->ensureConversation($deal->setRelation('listing', $listing));

                if (! $vtb) {
                    $hold = $this->wallet->hold(
                        $buyer,
                        $holdAmount,
                        WalletTransactionType::SafeDealHold,
                        "Холд по сделке {$deal->uuid}",
                        'safe_deal',
                        $deal->id,
                        'safe-deal-hold:'.$deal->id,
                    );

                    $deal->update(['hold_transaction_id' => $hold->id]);
                    $this->log($deal, $buyer, 'paid', $holdAmount, $hold->id, 'Средства заблокированы на балансе покупателя.');
                }

                $listing->forceFill(['reserved_at' => now()])->save();

                if ($offersCdek && $destination !== null) {
                    $this->attachDraftShipment($deal, $listing, $buyer, $destination, $quote);
                }

                return $deal->fresh(['listing', 'shipment']);
            });
        } catch (InsufficientFundsException $e) {
            throw ValidationException::withMessages(['balance' => [$e->getMessage()]]);
        }

        if (! $vtb) {
            $this->notifyDeal($deal, $deal->seller_id, 'Новая безопасная сделка', 'Покупатель оплатил объявление.');

            return $deal;
        }

        // Registering the hold talks to VTB, so it stays outside the transaction.
        try {
            $incoming = $this->settlement->openHold(
                $deal,
                $buyer,
                'Безопасная сделка: '.mb_substr((string) $listing->title, 0, 120),
                is_string($options['return_url'] ?? null) ? $options['return_url'] : null,
            );
        } catch (Throwable $e) {
            $this->releaseReservation($deal);
            $deal->update(['status' => SafeDealStatus::Cancelled, 'cancelled_at' => now()]);
            Log::error('SafeDeal: VTB pre-auth failed', ['deal' => $deal->uuid, 'exception' => $e->getMessage()]);

            throw ValidationException::withMessages(['payment' => ['Не удалось начать оплату. Попробуйте ещё раз.']]);
        }

        $deal->update([
            'metadata' => array_merge($deal->metadata ?? [], ['checkout_url' => $incoming->checkout_url]),
        ]);

        $this->log($deal, $buyer, 'checkout', $holdAmount, null, $this->settlement->holdsOnCard()
            ? 'Холд ВТБ зарегистрирован, ожидаем оплату.'
            : 'Заказ в ВТБ зарегистрирован, ожидаем оплату картой.');

        return $deal->fresh(['listing', 'shipment']) ?? $deal;
    }

    /**
     * VTB confirmed the card hold — the deal becomes payable and the seller is told.
     * Idempotent: repeated callbacks for the same order are no-ops.
     */
    public function markHoldAuthorized(SafeDeal $deal): SafeDeal
    {
        if ($deal->status !== SafeDealStatus::Created) {
            return $deal;
        }

        $onCard = $this->settlement->holdsOnCard();

        $deal->update([
            'status' => SafeDealStatus::Paid,
            'paid_at' => now(),
            'hold_expires_at' => now()->addDays($this->holdDays()),
        ]);
        $this->log($deal, null, 'paid', (int) $deal->amount_kopecks, null, $onCard
            ? 'ВТБ подтвердил холд на карте покупателя.'
            : 'ВТБ подтвердил оплату картой.');

        $fresh = $deal->fresh(['listing', 'shipment']);
        $this->notifyDeal($fresh, $fresh?->seller_id, 'Новая безопасная сделка', 'Покупатель оплатил объявление.');
        $this->notifyDeal($fresh, $fresh?->buyer_id, 'Оплата принята', $onCard
            ? 'Деньги удерживаются банком до подтверждения получения.'
            : 'Деньги на счёте платформы: продавец получит их после того, как вы подтвердите получение.');

        return $fresh;
    }

    /** The buyer never finished the card form — free the listing. */
    public function expireCheckout(SafeDeal $deal, string $note = 'Оплата не завершена, сделка отменена.'): SafeDeal
    {
        if ($deal->status !== SafeDealStatus::Created) {
            return $deal;
        }

        $deal->update(['status' => SafeDealStatus::Cancelled, 'cancelled_at' => now()]);
        $this->log($deal, null, 'cancelled', null, null, $note);
        $this->releaseReservation($deal);

        return $deal->fresh() ?? $deal;
    }

    public function ship(User $seller, SafeDeal $deal, ?string $trackingNumber, ?string $method): SafeDeal
    {
        $this->assertParticipant($deal, $seller, 'seller');

        if ($deal->status !== SafeDealStatus::Paid) {
            throw ValidationException::withMessages(['deal' => ['Отправить можно только оплаченную сделку.']]);
        }

        $cdekTracking = $this->tryCreateCdekOrder($seller, $deal);
        $tracking = $cdekTracking ?: $trackingNumber;
        $deliveryMethod = $cdekTracking ? 'СДЭК' : ($method ?: $deal->delivery_method);
        $deliveryStatus = $cdekTracking ? 'handed_to_cdek' : $deal->delivery_status;

        $deal->update([
            'status' => SafeDealStatus::Shipped,
            'shipped_at' => now(),
            'tracking_number' => $tracking,
            'delivery_method' => $deliveryMethod,
            'delivery_status' => $deliveryStatus,
        ]);

        $this->log($deal, $seller, 'shipped', null, null, $cdekTracking
            ? 'Заказ передан в СДЭК, трек-номер: '.$cdekTracking
            : 'Продавец отметил отправку.');

        $fresh = $deal->fresh(['listing', 'shipment', 'dispute']);
        $this->notifyDeal($fresh, $fresh?->buyer_id, 'Заказ отправлен', $tracking ? 'Трек-номер: '.$tracking : '');

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
            'delivery_status' => $deal->delivery_status ? 'received' : $deal->delivery_status,
        ]);

        $this->log($deal, $actor, 'delivered', null, null, $note);

        $fresh = $deal->fresh(['listing', 'shipment']);
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

    public function openDispute(User $user, SafeDeal $deal, string $reason, ?string $description, array $evidenceUuids = []): Dispute
    {
        $this->assertParticipant($deal, $user, 'any');

        if (! in_array($deal->status, [SafeDealStatus::Paid, SafeDealStatus::Shipped, SafeDealStatus::Delivered], true)) {
            throw ValidationException::withMessages(['deal' => ['Спор можно открыть только по активной сделке.']]);
        }

        if ($deal->status === SafeDealStatus::Disputed) {
            throw ValidationException::withMessages(['deal' => ['Спор по этой сделке уже открыт.']]);
        }

        if ($deal->hold_expires_at !== null && ! $deal->hold_expires_at->isFuture()) {
            throw ValidationException::withMessages(['deal' => ['Срок холда истёк, открыть спор нельзя.']]);
        }

        $evidence = $this->normalizeDisputeEvidence($user, $evidenceUuids);

        $dispute = DB::transaction(function () use ($user, $deal, $reason, $description, $evidence): Dispute {
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
                'evidence' => $evidence,
            ]);

            $this->log($deal, $user, 'disputed', null, null, "Открыт спор: {$reason}");

            return $dispute;
        });

        $fresh = $deal->fresh() ?? $deal;
        $otherId = (int) $user->id === (int) $fresh->buyer_id ? $fresh->seller_id : $fresh->buyer_id;
        $this->notifyDeal($fresh, $otherId, 'Открыт спор по сделке', $reason);

        return $dispute;
    }

    public function resolveDispute(
        User $admin,
        Dispute $dispute,
        string $inFavorOf,
        ?string $resolution,
        ?int $buyerKopecks = null,
        ?int $sellerKopecks = null,
    ): Dispute {
        if ($dispute->status !== DisputeStatus::Open) {
            throw ValidationException::withMessages(['dispute' => ['Спор уже закрыт.']]);
        }

        $deal = $dispute->safeDeal;

        // Money first, and outside a transaction: both paths talk to the bank,
        // and the dispute row must only close once the money actually moved.
        if ($inFavorOf === 'buyer') {
            $this->refundBuyer($deal, $admin, SafeDealStatus::Refunded, 'Спор решён в пользу покупателя.');
            $dispute->status = DisputeStatus::ResolvedBuyer;
        } elseif ($inFavorOf === 'split') {
            $this->splitPayout($deal, $admin, (int) $buyerKopecks, (int) $sellerKopecks, $resolution ?: 'Спор: сумма разделена.');
            $dispute->status = DisputeStatus::ResolvedSplit;
        } else {
            $this->releaseToSeller($deal, $admin, 'Спор решён в пользу продавца.');
            $dispute->status = DisputeStatus::ResolvedSeller;
        }

        $dispute->resolution = $resolution;
        $dispute->resolved_by = $admin->id;
        $dispute->resolved_at = now();
        $dispute->save();

        return $dispute->fresh();
    }

    private function releaseToSeller(SafeDeal $deal, ?User $actor, string $note): SafeDeal
    {
        // Capture first: crediting the seller before the bank settles would
        // hand out money we might never receive.
        $incoming = $this->activeIncoming($deal);
        if ($incoming !== null) {
            $this->settlement->capture($incoming);
        }

        $completed = DB::transaction(function () use ($deal, $actor, $note, $incoming): SafeDeal {
            $buyer = $deal->buyer;
            $seller = $deal->seller;

            if ($incoming === null) {
                $this->wallet->consumeHold($buyer, (int) $deal->amount_kopecks);
            }

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

            $this->releaseReservation($deal);

            $fresh = $deal->fresh() ?? $deal;
            $this->ratings->sync((int) $deal->seller_id);
            $this->ratings->sync((int) $deal->buyer_id);

            return $fresh;
        });

        // SBP pays the seller directly when their requisites allow it; the
        // wallet credit above is the fallback they can withdraw manually. The
        // bank call stays outside the transaction so it holds no row locks.
        $sbp = $this->startSellerPayout($completed);

        $this->notifyDeal($completed, $completed->seller_id, 'Сделка завершена', $sbp
            ? 'Выплата отправлена по СБП на ваш номер.'
            : 'Средства переведены на ваш баланс.');
        $this->notifyDeal($completed, $completed->buyer_id, 'Сделка завершена', '');

        return $completed;
    }

    private function startSellerPayout(SafeDeal $deal): bool
    {
        try {
            return $this->payouts->start($deal) !== null;
        } catch (Throwable $e) {
            Log::error('SafeDeal: seller payout could not be started', [
                'deal' => $deal->uuid,
                'exception' => $e->getMessage(),
            ]);

            return false;
        }
    }

    private function refundBuyer(SafeDeal $deal, ?User $actor, SafeDealStatus $finalStatus, string $note): SafeDeal
    {
        $incoming = $this->activeIncoming($deal);
        if ($incoming !== null) {
            $this->settlement->releaseBack($incoming);
        }

        return DB::transaction(function () use ($deal, $actor, $finalStatus, $note, $incoming): SafeDeal {
            $refund = $incoming !== null ? null : $this->wallet->refundHold(
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
                'refund_transaction_id' => $refund?->id,
            ]);

            $this->log($deal, $actor, $finalStatus->value, (int) $deal->amount_kopecks, $refund?->id, $note);
            $this->releaseReservation($deal);

            $fresh = $deal->fresh();
            $this->notifyDeal($fresh, $fresh?->buyer_id, 'Сделка отменена', match (true) {
                $incoming === null => 'Средства возвращены на баланс.',
                $incoming->isTwoStage() => 'Банк снял удержание, деньги вернутся на карту.',
                default => 'Возврат отправлен в банк, деньги вернутся на карту.',
            });
            $this->notifyDeal($fresh, $fresh?->seller_id, 'Сделка отменена', $note);

            return $fresh;
        });
    }

    /**
     * Wallet-only split: consume the hold, then credit buyer X and seller Y.
     * Card (VTB) one-stage charges cannot be split without a partial refund API.
     */
    private function splitPayout(SafeDeal $deal, ?User $actor, int $buyerKopecks, int $sellerKopecks, string $note): SafeDeal
    {
        $total = (int) $deal->amount_kopecks;
        if ($buyerKopecks < 0 || $sellerKopecks < 0 || $buyerKopecks + $sellerKopecks !== $total) {
            throw ValidationException::withMessages([
                'split' => ['Суммы покупателя и продавца должны в сумме равняться сумме сделки.'],
            ]);
        }

        $incoming = $this->activeIncoming($deal);
        if ($incoming !== null) {
            throw ValidationException::withMessages([
                'split' => ['Разделение суммы при оплате картой недоступно в одностадийном режиме ВТБ. Выберите полный возврат или полную выплату.'],
            ]);
        }

        $completed = DB::transaction(function () use ($deal, $actor, $buyerKopecks, $sellerKopecks, $note, $total): SafeDeal {
            $buyer = $deal->buyer;
            $seller = $deal->seller;

            $this->wallet->consumeHold($buyer, $total);

            $refund = $buyerKopecks > 0
                ? $this->wallet->credit(
                    $buyer,
                    $buyerKopecks,
                    WalletTransactionType::SafeDealRefund,
                    "Частичный возврат по сделке {$deal->uuid}",
                    'safe_deal',
                    $deal->id,
                    'safe-deal-split-refund:'.$deal->id,
                )
                : null;

            $payout = $sellerKopecks > 0
                ? $this->wallet->credit(
                    $seller,
                    $sellerKopecks,
                    WalletTransactionType::SafeDealPayout,
                    "Частичная выплата по сделке {$deal->uuid}",
                    'safe_deal',
                    $deal->id,
                    'safe-deal-split-payout:'.$deal->id,
                )
                : null;

            $deal->update([
                'status' => $sellerKopecks > 0 ? SafeDealStatus::Completed : SafeDealStatus::Refunded,
                'completed_at' => $sellerKopecks > 0 ? now() : null,
                'cancelled_at' => $sellerKopecks === 0 ? now() : null,
                'payout_transaction_id' => $payout?->id,
                'refund_transaction_id' => $refund?->id,
                'metadata' => array_merge($deal->metadata ?? [], [
                    'split' => [
                        'buyer_kopecks' => $buyerKopecks,
                        'seller_kopecks' => $sellerKopecks,
                    ],
                ]),
            ]);

            $this->log($deal, $actor, 'split', $sellerKopecks, $payout?->id, $note);
            $this->releaseReservation($deal);

            $fresh = $deal->fresh() ?? $deal;
            $this->ratings->sync((int) $deal->seller_id);
            $this->ratings->sync((int) $deal->buyer_id);

            return $fresh;
        });

        $this->notifyDeal($completed, $completed->buyer_id, 'Спор разрешён', 'Часть суммы возвращена на баланс.');
        $this->notifyDeal($completed, $completed->seller_id, 'Спор разрешён', $sellerKopecks > 0
            ? 'Часть суммы зачислена на баланс.'
            : $note);

        return $completed;
    }

    /**
     * @param  list<string>  $uuids
     * @return list<array{uuid: string, url: string|null, filename: string|null}>
     */
    private function normalizeDisputeEvidence(User $user, array $uuids): array
    {
        $uuids = array_values(array_unique(array_filter($uuids, fn ($id) => is_string($id) && $id !== '')));
        if (count($uuids) > 5) {
            throw ValidationException::withMessages(['evidence_uuids' => ['Можно приложить не больше 5 файлов.']]);
        }
        if ($uuids === []) {
            return [];
        }

        $media = Media::query()->whereIn('uuid', $uuids)->get()->keyBy('uuid');
        $out = [];
        foreach ($uuids as $uuid) {
            $row = $media->get($uuid);
            if ($row === null || (int) $row->uploaded_by !== (int) $user->id || $row->purpose !== 'dispute') {
                throw ValidationException::withMessages(['evidence_uuids' => ['Файл не найден или недоступен.']]);
            }
            $out[] = [
                'uuid' => $row->uuid,
                'url' => $row->url,
                'filename' => $row->filename,
            ];
        }

        return $out;
    }

    /** The VTB hold backing this deal, or null when it is a wallet deal. */
    private function activeIncoming(SafeDeal $deal): ?SafeDealIncomingPayment
    {
        if (! $this->settlement->usesVtb()) {
            return null;
        }

        return SafeDealIncomingPayment::query()
            ->where('safe_deal_id', $deal->id)
            ->whereIn('status', [
                SafeDealIncomingStatus::Authorized,
                SafeDealIncomingStatus::Captured,
            ])
            ->latest('id')
            ->first();
    }

    /** Puts the listing back on the market once the deal is no longer holding it. */
    private function releaseReservation(SafeDeal $deal): void
    {
        if ($deal->listing_id === null) {
            return;
        }

        Listing::query()->whereKey($deal->listing_id)->update(['reserved_at' => null]);
    }

    public function review(User $author, SafeDeal $deal, int $rating, ?string $text): UserReview
    {
        $this->assertParticipant($deal, $author, 'any');

        if ($deal->status !== SafeDealStatus::Completed) {
            throw ValidationException::withMessages(['deal' => ['Оценить можно только завершённую безопасную сделку.']]);
        }

        $targetId = (int) $author->id === (int) $deal->buyer_id ? (int) $deal->seller_id : (int) $deal->buyer_id;

        if (UserReview::query()->where('safe_deal_id', $deal->id)->where('author_id', $author->id)->exists()) {
            throw ValidationException::withMessages(['deal' => ['Вы уже оставили оценку по этой сделке.']]);
        }

        $review = UserReview::query()->create([
            'uuid' => (string) Str::uuid(),
            'author_id' => $author->id,
            'target_user_id' => $targetId,
            'safe_deal_id' => $deal->id,
            'rating' => $rating,
            'text' => $text,
        ]);

        $this->ratings->sync($targetId);

        return $review;
    }

    public function syncFromShipment(Shipment $shipment): void
    {
        $deal = $shipment->safeDeal
            ?? SafeDeal::query()->where('shipment_id', $shipment->id)->first()
            ?? ($shipment->safe_deal_id ? SafeDeal::query()->find($shipment->safe_deal_id) : null);

        if ($deal === null) {
            return;
        }

        $deliveryStatus = $this->deliveryStatusFromShipment($shipment->status);
        $updates = [
            'shipment_id' => $shipment->id,
            'tracking_number' => $shipment->tracking_number ?: $deal->tracking_number,
            'delivery_method' => $deal->delivery_method ?: 'СДЭК',
        ];
        if ($deliveryStatus !== null) {
            $updates['delivery_status'] = $deliveryStatus;
        }

        if (
            $deal->status === SafeDealStatus::Paid
            && in_array($shipment->status, [ShipmentStatus::Created, ShipmentStatus::Accepted, ShipmentStatus::InTransit, ShipmentStatus::AtPickup, ShipmentStatus::Delivered], true)
        ) {
            $updates['status'] = SafeDealStatus::Shipped;
            $updates['shipped_at'] = $deal->shipped_at ?? now();
        }

        $deal->update($updates);

        if ($shipment->status === ShipmentStatus::Delivered) {
            $this->markDelivered($deal->fresh() ?? $deal, null, 'СДЭК: посылка получена.');
        }
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

        $this->mailDeal($deal, $user, $title, $body);
    }

    /** Email mirrors every step; a mail failure must not roll back the deal. */
    private function mailDeal(SafeDeal $deal, User $user, string $title, string $body): void
    {
        if (! $user->email || ! NotificationPolicy::allows($user, 'deals', 'mail')) {
            return;
        }

        try {
            $user->notify(new SafeDealStatusNotification($deal->loadMissing('listing'), $title, $body));
        } catch (Throwable $e) {
            Log::warning('SafeDeal: status email failed', [
                'deal' => $deal->uuid,
                'user' => $user->id,
                'exception' => $e->getMessage(),
            ]);
        }
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

        // Every ledger entry is written after the deal's own status update, so
        // this is the single place that mirrors the lifecycle into the chat.
        $this->dealChat->announceStatus($deal, $note);
    }

    /** @return array<string, mixed> */
    public function toArray(SafeDeal $deal, ?User $viewer = null): array
    {
        $delivery = (int) ($deal->delivery_cost_kopecks ?? 0);
        $item = (int) (($deal->metadata['item_kopecks'] ?? null) ?: max(0, (int) $deal->amount_kopecks - $delivery));
        $myReview = null;
        if ($viewer !== null) {
            $row = $deal->relationLoaded('reviews')
                ? $deal->reviews->firstWhere('author_id', $viewer->id)
                : UserReview::query()->where('safe_deal_id', $deal->id)->where('author_id', $viewer->id)->first();
            if ($row) {
                $myReview = [
                    'rating' => (int) $row->rating,
                    'text' => $row->text,
                ];
            }
        }

        return [
            'can' => $this->canFlags($deal, $viewer),
            'uuid' => $deal->uuid,
            'listing_uuid' => $deal->listing?->uuid,
            'listing_title' => $deal->listing?->title,
            'status' => $deal->status->value,
            'status_label' => $this->lifecycleLabel($deal),
            'money_status' => $deal->status->value,
            'money_status_label' => $deal->status->label(),
            'item_kopecks' => $item,
            'amount_kopecks' => (int) $deal->amount_kopecks,
            'platform_fee_percent' => $this->platformFeePercent(),
            'platform_fee_kopecks' => (int) $deal->platform_fee_kopecks,
            'seller_payout_kopecks' => (int) $deal->seller_payout_kopecks,
            'delivery_cost_kopecks' => $delivery,
            'currency' => $deal->currency,
            'tracking_number' => $deal->tracking_number,
            'delivery_method' => $deal->delivery_method,
            'delivery_status' => $deal->delivery_status,
            'delivery_status_label' => $this->deliveryStatusLabel($deal->delivery_status),
            'destination_point' => $deal->destination_point,
            'shipment' => $deal->shipment ? [
                'uuid' => $deal->shipment->uuid,
                'status' => $deal->shipment->status->value,
                'tracking_number' => $deal->shipment->tracking_number,
                'external_status' => $deal->shipment->external_status,
            ] : null,
            'paid_at' => $deal->paid_at?->toIso8601String(),
            'shipped_at' => $deal->shipped_at?->toIso8601String(),
            'delivered_at' => $deal->delivered_at?->toIso8601String(),
            'completed_at' => $deal->completed_at?->toIso8601String(),
            'auto_release_at' => $deal->auto_release_at?->toIso8601String(),
            'hold_expires_at' => $deal->hold_expires_at?->toIso8601String(),
            'can_dispute' => in_array($deal->status, [SafeDealStatus::Paid, SafeDealStatus::Shipped, SafeDealStatus::Delivered], true)
                && ($deal->hold_expires_at === null || $deal->hold_expires_at->isFuture()),
            'can_review' => $viewer !== null
                && $deal->status === SafeDealStatus::Completed
                && $deal->involves($viewer)
                && $myReview === null,
            'my_review' => $myReview,
            'escrow_provider' => $deal->metadata['escrow_provider'] ?? SafeDealSettlementService::PROVIDER_WALLET,
            // Whether the money waits on the buyer's card or on our account —
            // the wording the buyer sees differs, the flow does not.
            'escrow_holds_on_card' => ($deal->metadata['escrow_provider'] ?? null) === SafeDealSettlementService::PROVIDER_VTB
                && $this->settlement->holdsOnCard(),
            // Present only while the buyer still has to pass the card form.
            'checkout_url' => $deal->status === SafeDealStatus::Created
                ? ($deal->metadata['checkout_url'] ?? null)
                : null,
        ];
    }

    private function assertPurchasable(Listing $listing, ?User $buyer = null): void
    {
        if ($listing->status !== ListingStatus::Published) {
            throw ValidationException::withMessages(['listing' => ['Объявление недоступно для покупки.']]);
        }

        if ((int) $listing->price_cents <= 0) {
            throw ValidationException::withMessages(['listing' => ['У объявления не указана цена.']]);
        }

        if ($listing->reserved_at !== null) {
            throw ValidationException::withMessages(['listing' => ['Объявление уже забронировано другим покупателем.']]);
        }

        if ($buyer !== null && (int) $listing->user_id === (int) $buyer->id) {
            throw ValidationException::withMessages(['listing' => ['Нельзя купить собственное объявление.']]);
        }
    }

    /**
     * @param  array<string, mixed>  $destination
     * @return array<string, mixed>|null
     */
    private function normalizeDestination(array $destination): ?array
    {
        $cityCode = (int) ($destination['city_code'] ?? 0);
        $pointId = trim((string) ($destination['external_point_id'] ?? $destination['id'] ?? ''));
        if ($cityCode <= 0) {
            return null;
        }

        return array_filter([
            'city_code' => $cityCode,
            'external_point_id' => $pointId !== '' ? $pointId : null,
            'name' => $destination['name'] ?? $destination['label'] ?? null,
            'address' => $destination['address'] ?? null,
            'latitude' => $destination['latitude'] ?? $destination['lat'] ?? null,
            'longitude' => $destination['longitude'] ?? $destination['lng'] ?? null,
        ], fn ($value) => $value !== null && $value !== '');
    }

    /**
     * @param  array<string, mixed>  $destination
     * @param  array{dimensions_cm: array{length: int, width: int, height: int}, weight_kg: float, package_size: ?string}  $parcel
     * @return array{price_cents: int, tariff_code: ?string, origin: array<string, mixed>}
     */
    private function quoteCdekDelivery(Listing $listing, array $destination, array $parcel): array
    {
        $origin = $this->resolveOriginPoint($listing);
        try {
            $result = app(CdekDeliveryAdapter::class)->quote($origin, $destination, [
                'weight_kg' => $parcel['weight_kg'],
                'dimensions_cm' => $parcel['dimensions_cm'],
            ]);
        } catch (RuntimeException $e) {
            throw ValidationException::withMessages([
                'destination_point' => ['Не удалось рассчитать доставку СДЭК: '.$e->getMessage()],
            ]);
        }

        return [
            'price_cents' => (int) $result['price_cents'],
            'tariff_code' => isset($result['tariff_code']) ? (string) $result['tariff_code'] : null,
            'origin' => $origin,
        ];
    }

    /** @return array<string, mixed> */
    private function resolveOriginPoint(Listing $listing): array
    {
        $listing->loadMissing(['author', 'city']);
        $profile = app(SellerDeliveryProfileService::class)->defaultFor(
            $listing->author ?? User::query()->findOrFail($listing->user_id),
            DeliveryCarrier::Cdek,
        );
        if ($profile instanceof SellerDeliveryProfile) {
            $snap = $profile->toPointSnapshot();
            if ((int) ($snap['city_code'] ?? 0) > 0) {
                return $snap;
            }
        }

        $cityName = trim((string) ($listing->city?->name ?? ''));
        if ($cityName !== '') {
            $rows = app(CdekApiExtension::class)->listCities(['city' => $cityName, 'country_codes' => 'RU']);
            foreach ($rows as $row) {
                if (is_array($row) && isset($row['code'])) {
                    return [
                        'city_code' => (int) $row['code'],
                        'label' => $cityName,
                    ];
                }
            }
        }

        throw ValidationException::withMessages([
            'listing' => ['Продавец не указал город отправки для СДЭК. Попросите добавить пункт в профиле доставки.'],
        ]);
    }

    /**
     * @param  array<string, mixed>  $destination
     * @param  array<string, mixed>  $quote
     */
    private function attachDraftShipment(SafeDeal $deal, Listing $listing, User $buyer, array $destination, array $quote): void
    {
        $parcel = $quote['parcel'] ?? ParcelSize::fromListing($listing);
        try {
            $shipment = app(ShipmentService::class)->createDraft($buyer, [
                'listing_uuid' => $listing->uuid,
                'provider' => DeliveryCarrier::Cdek->value,
                'destination_point' => $destination,
                'weight_kg' => $parcel['weight_kg'] ?? null,
                'dimensions_cm' => $parcel['dimensions_cm'] ?? null,
                'safe_deal_id' => $deal->id,
            ]);
            if (isset($quote['origin']) && is_array($quote['origin'])) {
                $shipment->update([
                    'source_point' => $quote['origin'],
                    'delivery_cost_cents' => $quote['delivery_cost_kopecks'] ?? 0,
                    'raw_payload' => array_merge($shipment->raw_payload ?? [], [
                        'tariff_code' => $quote['tariff_code'] ?? null,
                    ]),
                ]);
            }
            $deal->update(['shipment_id' => $shipment->id]);
        } catch (\Throwable) {
            // Deal is still valid without a CDEK draft; seller can ship manually.
        }
    }

    private function tryCreateCdekOrder(User $seller, SafeDeal $deal): ?string
    {
        $deal->loadMissing(['listing', 'shipment']);
        $listing = $deal->listing;
        if ($listing === null || ! ParcelSize::offersCdek($listing->delivery_methods ?? [])) {
            return null;
        }
        if (! is_array($deal->destination_point) && $deal->shipment === null) {
            return null;
        }

        $shipments = app(ShipmentService::class);
        $shipment = $deal->shipment;
        if ($shipment === null && is_array($deal->destination_point)) {
            $parcel = ParcelSize::fromListing($listing);
            $shipment = $shipments->createDraft($deal->buyer ?? User::query()->findOrFail($deal->buyer_id), [
                'listing_uuid' => $listing->uuid,
                'provider' => DeliveryCarrier::Cdek->value,
                'destination_point' => $deal->destination_point,
                'weight_kg' => $parcel['weight_kg'],
                'dimensions_cm' => $parcel['dimensions_cm'],
                'safe_deal_id' => $deal->id,
            ]);
            $deal->update(['shipment_id' => $shipment->id]);
        }

        if ($shipment === null) {
            return null;
        }

        try {
            if (in_array($shipment->status, [ShipmentStatus::Draft, ShipmentStatus::Quoted, ShipmentStatus::AwaitingSeller], true)) {
                if ($shipment->status === ShipmentStatus::Draft) {
                    $shipment = $shipments->quote($shipment);
                }
                $shipment = $shipments->confirmAndCreate($seller, $shipment);
            }
        } catch (\Throwable) {
            return $shipment->tracking_number;
        }

        return $shipment->tracking_number;
    }

    private function deliveryStatusFromShipment(ShipmentStatus $status): ?string
    {
        return match ($status) {
            ShipmentStatus::Created, ShipmentStatus::Accepted => 'handed_to_cdek',
            ShipmentStatus::InTransit => 'in_transit',
            ShipmentStatus::AtPickup => 'at_pickup',
            ShipmentStatus::Delivered => 'received',
            default => null,
        };
    }

    private function deliveryStatusLabel(?string $status): ?string
    {
        return match ($status) {
            'pending' => 'Ожидает передачи в СДЭК',
            'handed_to_cdek' => 'Передан в СДЭК',
            'in_transit' => 'В пути',
            'at_pickup' => 'Прибыл в ПВЗ',
            'received' => 'Получен покупателем',
            default => null,
        };
    }

    private function lifecycleLabel(SafeDeal $deal): string
    {
        return match ($deal->status) {
            SafeDealStatus::Created => 'Создан',
            SafeDealStatus::Paid => 'Оплачен (Средства захолдированы)',
            SafeDealStatus::Shipped => $this->deliveryStatusLabel($deal->delivery_status)
                ?? 'Передан в СДЭК (Трек-номер)',
            SafeDealStatus::Delivered => 'Получен покупателем',
            SafeDealStatus::Completed => 'Завершен (Деньги переведены продавцу)',
            SafeDealStatus::Disputed => 'Спор',
            SafeDealStatus::Refunded => 'Возврат',
            SafeDealStatus::Cancelled => 'Отменена',
        };
    }

    /** @return array<string, bool> per-ability flags for the viewer (see SafeDealPolicy). */
    private function canFlags(SafeDeal $deal, ?User $viewer): array
    {
        $flags = [];
        foreach (['view', 'pay', 'ship', 'markDelivered', 'confirmDelivery', 'cancel', 'openDispute', 'review'] as $ability) {
            $flags[$ability] = $viewer ? $viewer->can($ability, $deal) : false;
        }

        return $flags;
    }

}

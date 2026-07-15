<?php

namespace Modules\Billing\Services;

use App\Enums\EscrowDealStatus;
use App\Enums\ListingStatus;
use App\Models\EscrowDeal;
use App\Models\Listing;
use App\Models\User;
use App\Models\UserPayoutRequisites;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Modules\Billing\Clients\YooKassaClient;
use RuntimeException;

/**
 * YooKassa «Безопасная сделка» for marketplace listings.
 *
 * @see https://yookassa.ru/developers/solutions-for-platforms/safe-deal/
 */
class EscrowService
{
    public function __construct(
        private readonly YooKassaClient $yookassa,
        private readonly PaymentRecorder $recorder,
    ) {}

    public function isEnabled(): bool
    {
        return config('billing.yookassa.enabled')
            && config('billing.yookassa.shop_id')
            && config('billing.yookassa.secret_key')
            && config('billing.safe_deal.enabled');
    }

    /**
     * @return array{escrow_uuid: string, checkout_url: string|null, status: string, provider: string}
     */
    public function startCheckout(User $buyer, Listing $listing): array
    {
        $this->assertEnabled();

        if ($listing->status !== ListingStatus::Active) {
            throw ValidationException::withMessages([
                'listing' => ['Объявление недоступно для покупки.'],
            ]);
        }

        if ($listing->price_cents <= 0) {
            throw ValidationException::withMessages([
                'listing' => ['У объявления не указана цена.'],
            ]);
        }

        if ($listing->user_id === $buyer->id) {
            throw ValidationException::withMessages([
                'listing' => ['Нельзя купить собственное объявление.'],
            ]);
        }

        $seller = $listing->author;
        $card = UserPayoutRequisites::query()->where('user_id', $seller->id)->value('payout_card_number');

        if (! $card) {
            throw ValidationException::withMessages([
                'seller' => ['Продавец не указал карту для выплат. Безопасная сделка недоступна.'],
            ]);
        }

        $amountCents = $listing->price_cents;
        $feePercent = (float) config('billing.safe_deal.platform_fee_percent', 5);
        $platformFeeCents = (int) round($amountCents * $feePercent / 100);
        $sellerPayoutCents = $amountCents - $platformFeeCents;

        if ($sellerPayoutCents <= 0) {
            throw ValidationException::withMessages([
                'listing' => ['Сумма слишком мала для безопасной сделки.'],
            ]);
        }

        return DB::transaction(function () use ($buyer, $listing, $seller, $amountCents, $platformFeeCents, $sellerPayoutCents): array {
            $dealUuid = (string) Str::uuid();

            $remoteDeal = $this->yookassa->createDeal([
                'type' => 'safe_deal',
                'fee_moment' => config('billing.safe_deal.fee_moment', 'deal_closed'),
                'description' => "Сделка по объявлению #{$listing->id}",
                'metadata' => [
                    'listing_uuid' => $listing->uuid,
                    'buyer_id' => (string) $buyer->id,
                ],
            ], $dealUuid);

            $yookassaDealId = (string) ($remoteDeal['id'] ?? '');

            if ($yookassaDealId === '') {
                throw new RuntimeException('ЮKassa не вернула идентификатор сделки.');
            }

            $payment = $this->recorder->createPending(
                $buyer,
                $amountCents,
                $listing->currency ?? config('billing.currency', 'RUB'),
                'yookassa',
                [
                    'payable_type' => 'escrow',
                    'listing_id' => $listing->id,
                    'listing_uuid' => $listing->uuid,
                    'escrow_deal_uuid' => $dealUuid,
                ],
            );

            $escrow = EscrowDeal::create([
                'uuid' => $dealUuid,
                'listing_id' => $listing->id,
                'buyer_id' => $buyer->id,
                'seller_id' => $seller->id,
                'amount_cents' => $amountCents,
                'seller_payout_cents' => $sellerPayoutCents,
                'platform_fee_cents' => $platformFeeCents,
                'currency' => $listing->currency ?? 'RUB',
                'status' => EscrowDealStatus::PendingPayment,
                'yookassa_deal_id' => $yookassaDealId,
                'payment_id' => $payment->id,
            ]);

            $returnUrl = str_replace(
                '{listing_uuid}',
                $listing->uuid,
                (string) config('billing.safe_deal.return_url'),
            );

            $returnUrl = $this->appendQuery($returnUrl, [
                'escrow_uuid' => $escrow->uuid,
                'provider' => 'yookassa',
            ]);

            $amountValue = $this->formatMoney($amountCents);
            $payoutValue = $this->formatMoney($sellerPayoutCents);

            $remotePayment = $this->yookassa->createPayment([
                'amount' => [
                    'value' => $amountValue,
                    'currency' => strtoupper($escrow->currency),
                ],
                'capture' => true,
                'confirmation' => [
                    'type' => 'redirect',
                    'return_url' => $returnUrl,
                ],
                'description' => mb_substr("Безопасная сделка: {$listing->title}", 0, 128),
                'metadata' => [
                    'payment_uuid' => $payment->uuid,
                    'escrow_uuid' => $escrow->uuid,
                    'listing_uuid' => $listing->uuid,
                ],
                'deal' => [
                    'id' => $yookassaDealId,
                    'settlements' => [[
                        'type' => 'payout',
                        'amount' => [
                            'value' => $payoutValue,
                            'currency' => strtoupper($escrow->currency),
                        ],
                    ]],
                ],
            ], $payment->uuid);

            $providerPaymentId = (string) ($remotePayment['id'] ?? '');
            $checkoutUrl = $remotePayment['confirmation']['confirmation_url'] ?? null;

            if ($providerPaymentId === '' || ! is_string($checkoutUrl) || $checkoutUrl === '') {
                throw new RuntimeException('Не удалось создать платёж в ЮKassa.');
            }

            $payment->update([
                'provider_payment_id' => $providerPaymentId,
                'metadata' => array_merge($payment->metadata ?? [], ['checkout_url' => $checkoutUrl]),
            ]);

            $escrow->update(['yookassa_payment_id' => $providerPaymentId]);

            return [
                'escrow_uuid' => $escrow->uuid,
                'checkout_url' => $checkoutUrl,
                'status' => $escrow->status->value,
                'provider' => 'yookassa',
            ];
        });
    }

    public function markPaid(EscrowDeal $escrow, ?string $providerPaymentId = null): void
    {
        if ($escrow->status !== EscrowDealStatus::PendingPayment) {
            return;
        }

        $escrow->update([
            'status' => EscrowDealStatus::Paid,
            'paid_at' => now(),
            'yookassa_payment_id' => $providerPaymentId ?? $escrow->yookassa_payment_id,
        ]);
    }

    /** Buyer confirms receipt — payout to seller's saved card. */
    public function confirmReceipt(User $buyer, EscrowDeal $escrow): EscrowDeal
    {
        $this->assertEnabled();

        if ($escrow->buyer_id !== $buyer->id) {
            throw ValidationException::withMessages([
                'escrow' => ['Подтвердить получение может только покупатель.'],
            ]);
        }

        if ($escrow->status !== EscrowDealStatus::Paid) {
            throw ValidationException::withMessages([
                'escrow' => ['Сделка ещё не оплачена или уже завершена.'],
            ]);
        }

        $card = UserPayoutRequisites::query()
            ->where('user_id', $escrow->seller_id)
            ->value('payout_card_number');

        if (! $card) {
            throw ValidationException::withMessages([
                'seller' => ['У продавца нет карты для выплаты.'],
            ]);
        }

        $payoutValue = $this->formatMoney($escrow->seller_payout_cents);
        $idempotenceKey = 'payout-'.$escrow->uuid;

        $remote = $this->yookassa->createPayout([
            'amount' => [
                'value' => $payoutValue,
                'currency' => strtoupper($escrow->currency),
            ],
            'payout_destination_data' => [
                'type' => 'bank_card',
                'card' => ['number' => $card],
            ],
            'deal' => ['id' => $escrow->yookassa_deal_id],
            'description' => mb_substr("Выплата по безопасной сделке {$escrow->uuid}", 0, 128),
            'metadata' => [
                'escrow_uuid' => $escrow->uuid,
            ],
        ], $idempotenceKey);

        $payoutId = (string) ($remote['id'] ?? '');

        if ($payoutId === '') {
            throw new RuntimeException('ЮKassa не создала выплату продавцу.');
        }

        $escrow->update([
            'status' => EscrowDealStatus::Completed,
            'yookassa_payout_id' => $payoutId,
            'completed_at' => now(),
        ]);

        return $escrow->fresh();
    }

    public function findByPaymentProviderId(string $providerPaymentId): ?EscrowDeal
    {
        return EscrowDeal::query()
            ->where('yookassa_payment_id', $providerPaymentId)
            ->first();
    }

    /** @return array<string, mixed> */
    public function toArray(EscrowDeal $escrow): array
    {
        return [
            'uuid' => $escrow->uuid,
            'listing_uuid' => $escrow->listing?->uuid,
            'status' => $escrow->status->value,
            'amount_cents' => $escrow->amount_cents,
            'seller_payout_cents' => $escrow->seller_payout_cents,
            'platform_fee_cents' => $escrow->platform_fee_cents,
            'currency' => $escrow->currency,
            'paid_at' => $escrow->paid_at?->toIso8601String(),
            'completed_at' => $escrow->completed_at?->toIso8601String(),
        ];
    }

    private function assertEnabled(): void
    {
        if (! $this->isEnabled()) {
            throw ValidationException::withMessages([
                'escrow' => ['Безопасная сделка не подключена. Обратитесь к администратору.'],
            ]);
        }
    }

    private function formatMoney(int $cents): string
    {
        return number_format($cents / 100, 2, '.', '');
    }

    /** @param  array<string, string>  $params */
    private function appendQuery(string $url, array $params): string
    {
        $separator = str_contains($url, '?') ? '&' : '?';

        return $url.$separator.http_build_query($params);
    }
}

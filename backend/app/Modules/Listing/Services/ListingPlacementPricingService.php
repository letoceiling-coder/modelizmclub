<?php

namespace Modules\Listing\Services;

use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\Payment;
use App\Models\Promocode;
use App\Models\User;
use App\Models\UserSubscription;
use Modules\Billing\Services\PromocodeService;
use Modules\Listing\Support\ListingPlacementConfig;

class ListingPlacementPricingService
{
    public function __construct(
        private readonly PromocodeService $promocodes,
    ) {}

    /** @return array<string, mixed> */
    public function quote(User $user, ?int $categoryId, ?int $subcategoryId = null, ?string $promocodeCode = null): array
    {
        $category = $this->resolveCategory($categoryId, $subcategoryId);
        $baseCents = $this->basePriceCents($category);

        $subscription = $this->activeSubscription($user);
        $freeListingsRemaining = null;
        $subscriberAdjustment = 0;
        $freeReason = null;
        $priceAfterSubscription = $baseCents;

        if ($subscription) {
            $plan = $subscription->plan;
            $usedThisMonth = $this->freePlacementsUsedThisMonth($user);
            $freeQuota = (int) ($plan->free_listings_per_month ?? 0);
            $freeListingsRemaining = max(0, $freeQuota - $usedThisMonth);

            if ($freeListingsRemaining > 0) {
                $priceAfterSubscription = 0;
                $freeReason = 'subscription_quota';
            } else {
                /*
                 * Подписка не может сделать размещение дороже.
                 *
                 * Цена подписчика применялась поверх категорийной, даже когда
                 * та ниже: в бесплатной категории подписчик платил 20 ₽, а
                 * человек без подписки — ноль; в «ил 6» с ценой 1 ₽ списывали
                 * те же 20 ₽ (платёж 149 на проде, 15.09). Берём меньшее:
                 * подписка остаётся скидкой, а не наценкой.
                 */
                $subscriberPrice = $category && $category->subscriber_listing_price_cents !== null
                    ? (int) $category->subscriber_listing_price_cents
                    : ListingPlacementConfig::subscriberDefaultPriceCents();

                $priceAfterSubscription = min($baseCents, max(0, $subscriberPrice));
                $subscriberAdjustment = $priceAfterSubscription - $baseCents;
                if ($priceAfterSubscription === 0) {
                    $freeReason = 'subscriber_price';
                }
            }
        }

        $promoDiscount = 0;
        $promocodePayload = null;

        if ($promocodeCode && trim($promocodeCode) !== '') {
            try {
                $promocode = $this->promocodes->findValid(
                    $promocodeCode,
                    $user,
                    'listing_placement',
                    $category?->id,
                );
                $promoDiscount = $this->promocodes->discountCents($promocode, $priceAfterSubscription);
                $promocodePayload = [
                    'id' => $promocode->id,
                    'code' => $promocode->code,
                    'type' => $promocode->type,
                    'value' => $promocode->value,
                ];
            } catch (\Illuminate\Validation\ValidationException $e) {
                $promocodePayload = [
                    'code' => strtoupper(trim($promocodeCode)),
                    'error' => collect($e->errors())->flatten()->first(),
                ];
            }
        }

        $finalCents = max(0, $priceAfterSubscription - $promoDiscount);
        if ($finalCents === 0 && $promoDiscount > 0) {
            $freeReason ??= 'promocode';
        }

        $credits = (int) ($user->listing_placement_credits ?? 0);
        if ($credits >= 1 && $finalCents > 0) {
            $finalCents = 0;
            $freeReason = 'listing_credit';
        }

        return [
            'base_cents' => $baseCents,
            'subscriber_adjustment_cents' => $subscriberAdjustment,
            'price_after_subscription_cents' => $priceAfterSubscription,
            'promo_discount_cents' => $promoDiscount,
            'final_cents' => $finalCents,
            'currency' => config('billing.currency', 'RUB'),
            'is_free' => $finalCents === 0,
            'free_reason' => $finalCents === 0 ? $freeReason : null,
            'free_listings_remaining' => $freeListingsRemaining,
            'listing_placement_credits' => $credits,
            'has_active_subscription' => $subscription !== null,
            'category_id' => $category?->id,
            'category_name' => $category?->name,
            'promocode' => $promocodePayload,
        ];
    }

    public function assertCanPublish(User $user, ?int $categoryId, ?int $subcategoryId, ?string $promocodeCode, ?string $placementPaymentUuid): array
    {
        if (! ListingPlacementConfig::paymentEnabled()) {
            return ['final_cents' => 0, 'is_free' => true, 'promocode' => null];
        }

        $quote = $this->quote($user, $categoryId, $subcategoryId, $promocodeCode);

        // Нулевая цена от кредита — не бесплатность: кредит списывается ниже.
        // До 15.09 здесь был ранний возврат, и кредит не тратился (ДФ-5).
        if ($quote['final_cents'] === 0 && ($quote['free_reason'] ?? null) !== 'listing_credit') {
            return $quote;
        }

        if ($placementPaymentUuid) {
            $payment = Payment::query()
                ->where('uuid', $placementPaymentUuid)
                ->where('user_id', $user->id)
                ->first();

            if ($payment && $payment->status === 'paid' && $this->paymentMatchesQuote($payment, $quote, $categoryId, $subcategoryId)) {
                return $quote;
            }
        }

        $locked = User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();
        if ($locked->listing_placement_credits >= 1) {
            $locked->decrement('listing_placement_credits');

            return array_merge($quote, ['used_legacy_credit' => true]);
        }

        throw \Illuminate\Validation\ValidationException::withMessages([
            'publish' => ['Для публикации требуется оплата размещения.'],
            'placement_quote' => [$quote],
        ]);
    }

    /**
     * Размещение этого объявления уже оплачено.
     *
     * Публикация из черновика считала котировку заново и про привязанный
     * платёж не знала: за одно и то же объявление просили деньги второй раз
     * (приёмка 16.09). Платёж засчитывается, если он оплачен, относится к
     * размещению именно этого объявления и покрывает текущую цену — иначе
     * смена категории на более дорогую проходила бы по старой оплате.
     */
    public function listingPlacementPaid(Listing $listing, User $user): bool
    {
        if (! $listing->placement_payment_id) {
            return false;
        }

        $payment = Payment::query()
            ->whereKey($listing->placement_payment_id)
            ->where('user_id', $user->id)
            ->where('status', 'paid')
            ->first();

        if (! $payment || ($payment->metadata['payable_type'] ?? null) !== 'listing_placement') {
            return false;
        }

        $paidFor = $payment->metadata['listing_uuid'] ?? null;
        if ($paidFor !== null && $paidFor !== $listing->uuid) {
            return false;
        }

        $quote = $this->quote($user, $listing->category_id, $listing->subcategory_id);

        return (int) $payment->amount_cents >= (int) $quote['final_cents'];
    }

    /** @param array<string, mixed> $quote */
    public function applyPlacementToListing(Listing $listing, User $user, array $quote, ?Payment $payment = null, ?Promocode $promocode = null): void
    {
        $listing->placement_was_free = (bool) ($quote['is_free'] ?? false);
        $listing->placement_amount_cents = $payment?->amount_cents ?? ($quote['final_cents'] ?? 0);

        if ($payment) {
            $listing->placement_payment_id = $payment->id;
        }

        if ($promocode) {
            $listing->placement_promocode_id = $promocode->id;
            $this->promocodes->recordUsage($promocode, $user, $payment?->id);
        }
    }

    private function paymentMatchesQuote(Payment $payment, array $quote, ?int $categoryId, ?int $subcategoryId): bool
    {
        if (($payment->metadata['payable_type'] ?? null) !== 'listing_placement') {
            return false;
        }

        if ((int) $payment->amount_cents !== (int) $quote['final_cents']) {
            return false;
        }

        $metaCategory = $payment->metadata['category_id'] ?? null;
        $metaSub = $payment->metadata['subcategory_id'] ?? null;

        return (int) ($metaCategory ?? 0) === (int) ($categoryId ?? 0)
            && (int) ($metaSub ?? 0) === (int) ($subcategoryId ?? 0);
    }

    private function resolveCategory(?int $categoryId, ?int $subcategoryId): ?ListingCategory
    {
        if ($subcategoryId) {
            $sub = ListingCategory::query()->whereKey($subcategoryId)->where('is_active', true)->first();
            if ($sub) {
                return $sub;
            }
        }

        if ($categoryId) {
            return ListingCategory::query()->whereKey($categoryId)->where('is_active', true)->first();
        }

        return null;
    }

    private function basePriceCents(?ListingCategory $category): int
    {
        if ($category) {
            if ($category->listing_price_cents !== null) {
                return max(0, (int) $category->listing_price_cents);
            }

            if ($category->parent_id) {
                $parent = ListingCategory::query()->find($category->parent_id);
                if ($parent?->listing_price_cents !== null) {
                    return max(0, (int) $parent->listing_price_cents);
                }
            }
        }

        return ListingPlacementConfig::registeredPriceCents();
    }

    private function activeSubscription(User $user): ?UserSubscription
    {
        if (! $user->hasActiveSubscription()) {
            return null;
        }

        return UserSubscription::query()
            ->with('plan')
            ->where('user_id', $user->id)
            ->where('status', 'active')
            ->where(function ($q): void {
                $q->whereNull('ends_at')->orWhere('ends_at', '>', now());
            })
            ->latest('starts_at')
            ->first();
    }

    private function freePlacementsUsedThisMonth(User $user): int
    {
        $start = now()->startOfMonth();
        $end = now()->endOfMonth();

        return Listing::query()
            ->where('user_id', $user->id)
            ->where('placement_was_free', true)
            ->whereNotNull('published_at')
            ->whereBetween('published_at', [$start, $end])
            ->count();
    }
}

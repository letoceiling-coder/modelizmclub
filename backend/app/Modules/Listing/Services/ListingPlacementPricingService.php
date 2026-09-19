<?php

namespace Modules\Listing\Services;

use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\Payment;
use App\Models\User;
use App\Models\UserSubscription;
use Modules\Billing\Services\PromocodeService;
use Modules\Listing\Support\ListingPlacementConfig;

class ListingPlacementPricingService
{
    public function __construct(
        private readonly PromocodeService $promocodes,
    ) {}

    /**
     * Цена размещения и то, что её покрывает.
     *
     * Сначала считается цена: категория (или её родитель, или общая), для
     * подписчика — не дороже цены подписчика, минус промокод. Если она
     * нулевая — размещение бесплатно само по себе, и ни квота, ни кредит не
     * тратятся. Иначе её покрывают по порядку (решение 19.09):
     *
     *   1. персональная квота человека (или «без ограничения»);
     *   2. месячная квота тарифа подписки;
     *   3. кредит размещения;
     *   4. иначе — оплата.
     *
     * Котировку открывают просто посмотреть, поэтому здесь ничего не
     * списывается: квоту и кредит тратит создание объявления
     * (ListingService::resolveCreateStatus) условным UPDATE.
     *
     * @return array<string, mixed>
     */
    public function quote(User $user, ?int $categoryId, ?int $subcategoryId = null, ?string $promocodeCode = null): array
    {
        $category = $this->resolveCategory($categoryId, $subcategoryId);
        $baseCents = $this->basePriceCents($category);

        $subscription = $this->activeSubscription($user);
        $subscriberAdjustment = 0;
        $priceAfterSubscription = $baseCents;

        if ($subscription) {
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

        $priceCents = max(0, $priceAfterSubscription - $promoDiscount);
        $finalCents = $priceCents;
        $freeReason = null;

        $personalRemaining = $user->personalFreeListingsRemaining();
        $planRemaining = null;
        if ($subscription) {
            $planQuota = (int) ($subscription->plan->free_listings_per_month ?? 0);
            $planRemaining = max(0, $planQuota - $this->freePlacementsUsedThisMonth($user));
        }
        $credits = (int) ($user->listing_placement_credits ?? 0);

        if ($priceCents === 0) {
            $freeReason = match (true) {
                $baseCents === 0 => 'free_category',
                $promoDiscount > 0 => 'promocode',
                default => 'subscriber_price',
            };
        } elseif ($personalRemaining === null || $personalRemaining > 0) {
            $finalCents = 0;
            $freeReason = 'personal_quota';
        } elseif (($planRemaining ?? 0) > 0) {
            $finalCents = 0;
            $freeReason = 'subscription_quota';
        } elseif ($credits >= 1) {
            $finalCents = 0;
            $freeReason = 'listing_credit';
        }

        return [
            'base_cents' => $baseCents,
            'subscriber_adjustment_cents' => $subscriberAdjustment,
            'price_after_subscription_cents' => $priceAfterSubscription,
            'promo_discount_cents' => $promoDiscount,
            // Цена до квот и кредита — её списывает кредит и её платят.
            'price_cents' => $priceCents,
            'final_cents' => $finalCents,
            'currency' => config('billing.currency', 'RUB'),
            'is_free' => $finalCents === 0,
            'free_reason' => $finalCents === 0 ? $freeReason : null,
            'free_listings_remaining' => $planRemaining,
            'personal_free_listings_remaining' => $personalRemaining,
            'personal_free_listings_unlimited' => $personalRemaining === null,
            'listing_placement_credits' => $credits,
            'has_active_subscription' => $subscription !== null,
            'category_id' => $category?->id,
            'category_name' => $category?->name,
            'promocode' => $promocodePayload,
        ];
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
        /*
         * Кредит размещения — тоже оплата, просто внесённая заранее: платежа
         * у объявления нет, но единица списана и цена записана в
         * `placement_amount_cents` (см. ListingService::resolveCreateStatus).
         * Без этой ветки человек, опубликовавший по кредиту, после возврата
         * в черновик снова упирался в оплату.
         */
        // Размещение, покрытое квотой, тоже уже состоялось: повторная
        // публикация того же объявления вторую единицу квоты не тратит.
        if (in_array($listing->placement_free_reason, ['personal_quota', 'subscription_quota'], true)) {
            return true;
        }

        if (! $listing->placement_payment_id) {
            return ! $listing->placement_was_free && (int) $listing->placement_amount_cents > 0;
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

        // Только то, что покрыла квота тарифа. До 19.09 считались все
        // бесплатные размещения, включая бесплатные категории, — квота
        // тратилась на то, что и так ничего не стоило. Старые строки без
        // причины не считаются: квоты тарифов до 19.09 были нулевыми.
        // По моменту размещения, а не публикации: объявление на модерации ещё
        // не опубликовано, но квоту уже заняло.
        return Listing::withTrashed()
            ->where('user_id', $user->id)
            ->where('placement_free_reason', 'subscription_quota')
            ->whereBetween('placement_covered_at', [$start, $end])
            ->count();
    }
}

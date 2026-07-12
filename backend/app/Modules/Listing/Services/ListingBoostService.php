<?php

namespace Modules\Listing\Services;

use App\Enums\ListingStatus;
use App\Models\Listing;
use App\Models\ListingPricingRule;
use App\Models\ListingPromotion;
use App\Models\ListingViewDaily;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Modules\Billing\Contracts\PaymentGateway;

class ListingBoostService
{
    public function __construct(
        private readonly PaymentGateway $gateway,
    ) {}

    /** @return list<array<string, mixed>> */
    public function packages(): array
    {
        return ListingPricingRule::query()
            ->whereNull('category_id')
            ->where('base_price_cents', '>', 0)
            ->orderBy('duration_days')
            ->get()
            ->filter(fn (ListingPricingRule $rule) => ($rule->settings['type'] ?? null) === 'boost')
            ->map(fn (ListingPricingRule $rule) => [
                'id' => $rule->packageId() ?? "boost-{$rule->duration_days}",
                'label' => $rule->label(),
                'days' => $rule->duration_days,
                'price_cents' => $rule->base_price_cents,
            ])
            ->values()
            ->all();
    }

    public function findPackage(string $packageId): ListingPricingRule
    {
        $rule = ListingPricingRule::query()
            ->whereNull('category_id')
            ->get()
            ->first(fn (ListingPricingRule $r) => $r->packageId() === $packageId);

        if (! $rule || ($rule->settings['type'] ?? null) !== 'boost') {
            throw ValidationException::withMessages([
                'package' => ['Пакет продвижения не найден.'],
            ]);
        }

        return $rule;
    }

    /** @return array<string, mixed> */
    public function createPromoteCheckout(User $user, Listing $listing, string $packageId, ?string $idempotencyKey): array
    {
        if ($listing->user_id !== $user->id) {
            throw ValidationException::withMessages([
                'listing' => ['Можно продвигать только свои объявления.'],
            ]);
        }

        if ($listing->status !== ListingStatus::Published) {
            throw ValidationException::withMessages([
                'listing' => ['Продвижение доступно только для активных объявлений.'],
            ]);
        }

        if ($this->isPromoted($listing)) {
            throw ValidationException::withMessages([
                'listing' => ['Объявление уже продвигается.'],
            ]);
        }

        $package = $this->findPackage($packageId);

        return $this->gateway->createCheckout(
            $user,
            $package->base_price_cents,
            config('billing.currency', 'RUB'),
            "Продвижение «{$listing->title}» — {$package->label()}",
            [
                'payable_type' => 'listing_boost',
                'listing_id' => $listing->id,
                'listing_uuid' => $listing->uuid,
                'package_id' => $packageId,
                'duration_days' => $package->duration_days,
                'idempotency_key' => $idempotencyKey,
            ],
        );
    }

    public function isPromoted(Listing $listing): bool
    {
        if ($listing->paid_until && $listing->paid_until->isFuture()) {
            return true;
        }

        return ListingPromotion::query()
            ->where('listing_id', $listing->id)
            ->where('paid_until', '>', now())
            ->exists();
    }

    public function promotedUntil(Listing $listing): ?Carbon
    {
        $until = collect([
            $listing->paid_until,
            ListingPromotion::query()
                ->where('listing_id', $listing->id)
                ->max('paid_until'),
        ])->filter()->map(fn ($v) => $v instanceof Carbon ? $v : Carbon::parse($v))->max();

        return $until && $until->isFuture() ? $until : null;
    }

    public function activate(Listing $listing, int $durationDays): void
    {
        $starts = now();
        $currentUntil = $this->promotedUntil($listing);
        $paidUntil = ($currentUntil && $currentUntil->isFuture())
            ? $currentUntil->copy()->addDays($durationDays)
            : $starts->copy()->addDays($durationDays);

        DB::transaction(function () use ($listing, $paidUntil, $durationDays): void {
            ListingPromotion::query()->create([
                'listing_id' => $listing->id,
                'type' => 'boost',
                'paid_until' => $paidUntil,
            ]);

            $listing->update(['paid_until' => $paidUntil]);
        });
    }
}

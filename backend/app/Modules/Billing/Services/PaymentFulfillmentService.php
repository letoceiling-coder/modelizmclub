<?php

namespace Modules\Billing\Services;

use App\Models\Listing;
use App\Models\Payment;
use App\Models\Promocode;
use App\Models\SubscriptionPlan;
use App\Models\User;
use App\Models\UserSubscription;
use Illuminate\Support\Facades\DB;

class PaymentFulfillmentService
{
    public function markPaid(Payment $payment, ?string $providerPaymentId = null): void
    {
        DB::transaction(function () use ($payment, $providerPaymentId): void {
            $locked = Payment::query()->whereKey($payment->id)->lockForUpdate()->first();

            if (! $locked || $locked->status === 'paid') {
                return;
            }

            $updates = [
                'status' => 'paid',
                'paid_at' => now(),
            ];

            if ($providerPaymentId) {
                $updates['provider_payment_id'] = $providerPaymentId;
            }

            $locked->update($updates);

            $this->dispatchFulfillment($locked);
        });
    }

    /**
     * Runs the post-payment side effects for an already-paid payment. Used both
     * by gateway webhooks and by wallet-balance payments (spec v4.0 §1.2).
     */
    public function dispatchFulfillment(Payment $payment): void
    {
        $payableType = $payment->metadata['payable_type'] ?? null;

        if ($payableType === 'wallet_topup') {
            $this->creditWalletTopup($payment);

            return;
        }

        $planId = $payment->metadata['plan_id'] ?? null;

        if ($planId) {
            $this->activateSubscription($payment->user, (int) $planId);
        }

        if ($payableType === 'listing_boost') {
            $this->activateListingBoost($payment);
        }

        if ($payableType === 'listing_placement') {
            $this->fulfillListingPlacement($payment);
        }
    }

    private function creditWalletTopup(Payment $payment): void
    {
        app(WalletService::class)->credit(
            $payment->user,
            (int) $payment->amount_cents,
            \App\Enums\WalletTransactionType::Topup,
            'Пополнение баланса',
            'payment',
            $payment->id,
            'topup:'.$payment->id,
        );
    }

    private function fulfillListingPlacement(Payment $payment): void
    {
        $listingUuid = $payment->metadata['listing_uuid'] ?? null;

        if ($listingUuid) {
            $listing = Listing::query()->where('uuid', $listingUuid)->first();

            if ($listing && (int) $listing->user_id === (int) $payment->user_id) {
                $listing->update([
                    'placement_payment_id' => $payment->id,
                    'placement_amount_cents' => $payment->amount_cents,
                    'placement_was_free' => false,
                ]);

                $promocodeId = $payment->metadata['promocode_id'] ?? null;
                if ($promocodeId) {
                    $promocode = Promocode::query()->find($promocodeId);
                    if ($promocode) {
                        $listing->update(['placement_promocode_id' => $promocode->id]);
                        app(\Modules\Billing\Services\PromocodeService::class)
                            ->recordUsage($promocode, $payment->user, $payment->id);
                    }
                }

                app(\Modules\Listing\Services\ListingService::class)->finalizeAfterPlacement($listing);

                return;
            }
        }

        $payment->user->increment('listing_placement_credits');
    }

    private function activateListingBoost(Payment $payment): void
    {
        $listingId = $payment->metadata['listing_id'] ?? null;
        $days = (int) ($payment->metadata['duration_days'] ?? 0);

        if (! $listingId || $days <= 0) {
            return;
        }

        $listing = \App\Models\Listing::query()->find($listingId);

        if ($listing) {
            app(\Modules\Listing\Services\ListingBoostService::class)->activate($listing, $days);
        }
    }

    public function markFailed(Payment $payment, ?string $reason = null): void
    {
        if ($payment->status === 'paid') {
            return;
        }

        $metadata = $payment->metadata ?? [];
        if ($reason) {
            $metadata['failure_reason'] = $reason;
        }

        $payment->update([
            'status' => 'failed',
            'metadata' => $metadata,
        ]);
    }

    public function activateSubscription(User $user, int $planId, ?\DateTimeInterface $endsAt = null): UserSubscription
    {
        $plan = SubscriptionPlan::query()->findOrFail($planId);
        $startsAt = now();
        $endsAt = $endsAt
            ? \Illuminate\Support\Carbon::parse($endsAt)
            : $startsAt->copy()->addDays($plan->period_days);

        UserSubscription::query()
            ->where('user_id', $user->id)
            ->where('status', 'active')
            ->update([
                'status' => 'cancelled',
                'cancelled_at' => now(),
                'auto_renew' => false,
            ]);

        return UserSubscription::query()->create([
            'user_id' => $user->id,
            'plan_id' => $plan->id,
            'status' => 'active',
            'starts_at' => $startsAt,
            'ends_at' => $endsAt,
            'auto_renew' => true,
        ]);
    }
}

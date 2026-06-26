<?php

namespace Modules\Billing\Services;

use App\Models\Payment;
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

            $planId = $locked->metadata['plan_id'] ?? null;

            if ($planId) {
                $this->activateSubscription($locked->user, (int) $planId);
            }
        });
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

    public function activateSubscription(User $user, int $planId): UserSubscription
    {
        $plan = SubscriptionPlan::query()->findOrFail($planId);
        $startsAt = now();
        $endsAt = $startsAt->copy()->addDays($plan->period_days);

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

<?php

namespace Modules\Billing\Services;

use App\Enums\WalletTransactionType;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Pays for subscriptions and listing placements directly from the internal
 * wallet balance (spec v4.0 §1.2), reusing the shared fulfillment pipeline.
 */
class WalletPaymentService
{
    public function __construct(
        private readonly WalletService $wallet,
        private readonly PaymentFulfillmentService $fulfillment,
    ) {}

    /**
     * @param  array<string, mixed>  $metadata
     */
    public function pay(User $user, int $amountKopecks, WalletTransactionType $type, string $description, array $metadata): Payment
    {
        return DB::transaction(function () use ($user, $amountKopecks, $type, $description, $metadata): Payment {
            $payment = Payment::query()->create([
                'uuid' => (string) Str::uuid(),
                'user_id' => $user->id,
                'amount_cents' => $amountKopecks,
                'currency' => config('billing.currency', 'RUB'),
                'status' => 'paid',
                'provider' => 'wallet',
                'paid_at' => now(),
                'metadata' => $metadata,
            ]);

            $this->wallet->debit(
                $user,
                $amountKopecks,
                $type,
                $description,
                'payment',
                $payment->id,
                'wallet-pay:'.$payment->id,
            );

            $this->fulfillment->dispatchFulfillment($payment);

            return $payment;
        });
    }
}

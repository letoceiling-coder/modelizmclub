<?php

namespace Modules\Billing\Services;

use App\Models\Payment;
use App\Models\User;
use Illuminate\Support\Str;

class PaymentRecorder
{
    /**
     * @param  array<string, mixed>  $metadata
     */
    public function createPending(
        User $user,
        int $amountCents,
        string $currency,
        string $provider,
        array $metadata = [],
        ?string $idempotencyKey = null,
    ): Payment {
        if ($idempotencyKey) {
            $existing = Payment::query()
                ->where('idempotency_key', $idempotencyKey)
                ->where('user_id', $user->id)
                ->first();

            if ($existing) {
                return $existing;
            }
        }

        return Payment::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $user->id,
            'amount_cents' => $amountCents,
            'currency' => $currency,
            'status' => 'pending',
            'provider' => $provider,
            'idempotency_key' => $idempotencyKey,
            'metadata' => $metadata,
        ]);
    }
}

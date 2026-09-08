<?php

namespace Modules\Billing\Services;

use App\Models\Payment;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
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
            $existing = $this->byKey($user, $idempotencyKey);

            if ($existing) {
                return $existing;
            }
        }

        try {
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
        } catch (UniqueConstraintViolationException $e) {
            /*
             * Два нажатия «Оплатить» подряд — это два запроса, идущих
             * одновременно. Проверка выше у обоих проходит: строки ещё нет ни
             * у кого. Дальше вставляют оба, и второму отвечает уникальный
             * индекс `payments.idempotency_key`.
             *
             * До этой ветки такой отказ уходил пользователю пятисоткой — при
             * том, что платёж создан и оплачивать надо именно его. Возвращаем
             * строку, которую успел вставить сосед: с точки зрения нажавшего
             * оба нажатия привели к одной оплате, чего он и ждёт.
             */
            $existing = $idempotencyKey ? $this->byKey($user, $idempotencyKey) : null;

            if ($existing) {
                return $existing;
            }

            throw $e;
        }
    }

    private function byKey(User $user, string $idempotencyKey): ?Payment
    {
        return Payment::query()
            ->where('idempotency_key', $idempotencyKey)
            ->where('user_id', $user->id)
            ->first();
    }
}

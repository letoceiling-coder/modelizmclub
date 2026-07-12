<?php

namespace Modules\Account\Services;

use App\Models\SavedPaymentMethod;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class PaymentMethodService
{
    public function __construct(
        private readonly CardBindingService $binding,
    ) {}

    /** @return list<array<string, mixed>> */
    public function list(User $user): array
    {
        return SavedPaymentMethod::query()
            ->where('user_id', $user->id)
            ->orderByDesc('is_default')
            ->orderByDesc('id')
            ->get()
            ->map(fn (SavedPaymentMethod $method) => [
                'id' => $method->uuid,
                'brand' => $method->brand,
                'last4' => $method->last4,
                'is_default' => $method->is_default,
            ])
            ->all();
    }

    /** @return array{binding_url: string} */
    public function startBinding(User $user): array
    {
        return $this->binding->start($user);
    }

    public function delete(User $user, string $uuid): void
    {
        $method = SavedPaymentMethod::query()
            ->where('user_id', $user->id)
            ->where('uuid', $uuid)
            ->first();

        if (! $method) {
            throw ValidationException::withMessages([
                'id' => ['Способ оплаты не найден.'],
            ]);
        }

        $method->delete();
    }
}

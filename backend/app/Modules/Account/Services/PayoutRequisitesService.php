<?php

namespace Modules\Account\Services;

use App\Models\User;
use App\Models\UserPayoutRequisites;

class PayoutRequisitesService
{
    /** @return array{card_last4: string|null} */
    public function show(User $user): array
    {
        $record = UserPayoutRequisites::query()->find($user->id);
        $card = $record?->payout_card_number;

        return [
            'card_last4' => $card ? substr(preg_replace('/\D/', '', $card), -4) : null,
        ];
    }

    public function update(User $user, string $cardNumber): void
    {
        $digits = preg_replace('/\D/', '', $cardNumber) ?? '';

        UserPayoutRequisites::query()->updateOrCreate(
            ['user_id' => $user->id],
            ['payout_card_number' => $digits],
        );
    }
}

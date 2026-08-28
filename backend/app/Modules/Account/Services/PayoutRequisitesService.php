<?php

namespace Modules\Account\Services;

use App\Models\User;
use App\Models\UserPayoutRequisites;

class PayoutRequisitesService
{
    /** @return array{card_last4: string|null, preferred_channel: string, sbp_bank_id: string|null, sbp_bank_name: string|null, sbp_full_name: string|null, has_sbp_phone: bool} */
    public function show(User $user): array
    {
        $record = UserPayoutRequisites::query()->find($user->id);
        $card = $record?->payout_card_number;

        return [
            'card_last4' => $card ? substr(preg_replace('/\D/', '', $card), -4) : ($record?->card_last4),
            'preferred_channel' => $record?->preferred_channel ?? 'sbp',
            'sbp_bank_id' => $record?->sbp_bank_id,
            'sbp_bank_name' => $record?->sbp_bank_name,
            'sbp_full_name' => $record?->sbp_full_name,
            'has_sbp_phone' => filled($record?->sbp_phone),
        ];
    }

    public function update(User $user, string $cardNumber): void
    {
        $digits = preg_replace('/\D/', '', $cardNumber) ?? '';

        UserPayoutRequisites::query()->updateOrCreate(
            ['user_id' => $user->id],
            ['payout_card_number' => $digits, 'card_last4' => substr($digits, -4)],
        );
    }
}

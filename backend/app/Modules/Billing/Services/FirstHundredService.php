<?php

namespace Modules\Billing\Services;

use App\Enums\WalletTransactionType;
use App\Models\User;
use App\Support\FirstHundredPromo;
use Illuminate\Support\Facades\DB;

class FirstHundredService
{
    public function __construct(
        private readonly WalletService $wallet,
    ) {}

    /**
     * Mark an early registrant for the first-hundred promo (once per user).
     * Does not activate a subscription — that happens only after a paid payment.
     */
    public function tryGrant(User $user): bool
    {
        if ($user->is_first_hundred) {
            return false;
        }

        $config = FirstHundredPromo::get();

        if (! $config['enabled']) {
            return false;
        }

        return DB::transaction(function () use ($user, $config): bool {
            $locked = User::query()->whereKey($user->id)->lockForUpdate()->first();

            if (! $locked || $locked->is_first_hundred) {
                return false;
            }

            if (FirstHundredPromo::takenCount() >= $config['total']) {
                return false;
            }

            $bonusKopecks = (int) ($config['bonus_kopecks'] ?? 0);
            if ($bonusKopecks > 0) {
                $this->wallet->credit(
                    $locked,
                    $bonusKopecks,
                    WalletTransactionType::PromoBonus,
                    'Бонус «Первые 100»',
                    'promo_first_hundred',
                    $locked->id,
                    'first-hundred:'.$locked->id,
                );
            }

            $locked->forceFill([
                'is_first_hundred' => true,
                'first_hundred_granted_at' => now(),
            ])->save();

            return true;
        });
    }
}

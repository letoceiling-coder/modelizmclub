<?php

namespace Modules\Billing\Services;

use App\Models\BonusAccount;
use App\Models\BonusTransaction;
use App\Models\User;

class WalletService
{
    /** @return array{balance: int, currency: string} */
    public function balance(User $user): array
    {
        $account = BonusAccount::query()->firstOrCreate(
            ['user_id' => $user->id],
            ['balance' => 0],
        );

        return [
            'balance' => $account->balance,
            'currency' => config('billing.currency', 'RUB'),
        ];
    }

    /**
     * @return array{data: list<array<string, mixed>>}
     */
    public function transactions(User $user, int $perPage = 20): array
    {
        BonusAccount::query()->firstOrCreate(
            ['user_id' => $user->id],
            ['balance' => 0],
        );

        $rows = BonusTransaction::query()
            ->where('account_user_id', $user->id)
            ->orderByDesc('created_at')
            ->limit($perPage)
            ->get();

        return [
            'data' => $rows->map(fn (BonusTransaction $tx) => [
                'id' => (string) $tx->id,
                'type' => $tx->amount >= 0 ? 'in' : 'out',
                'amount' => abs($tx->amount),
                'title' => $tx->description ?? $tx->type,
                'date' => $tx->created_at?->toIso8601String(),
            ])->all(),
        ];
    }
}

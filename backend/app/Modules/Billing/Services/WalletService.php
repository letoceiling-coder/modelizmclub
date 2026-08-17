<?php

namespace Modules\Billing\Services;

use App\Enums\WalletTransactionType;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use Illuminate\Support\Facades\DB;
use Modules\Billing\Exceptions\InsufficientFundsException;

/**
 * Atomic internal wallet ledger (spec v4.0 §1.1).
 *
 * Balances are stored in kopecks. Every mutation writes an immutable
 * wallet_transactions row with balance_before / balance_after so the ledger
 * is fully auditable. Concurrency is guarded with SELECT ... FOR UPDATE plus
 * an optimistic `version` counter.
 */
class WalletService
{
    public function wallet(User $user): Wallet
    {
        return Wallet::query()->firstOrCreate(
            ['user_id' => $user->id],
            ['balance_kopecks' => 0, 'held_kopecks' => 0],
        );
    }

    public function balanceKopecks(User $user): int
    {
        return (int) $this->wallet($user)->balance_kopecks;
    }

    /** Legacy shape kept for existing frontend (rubles rounded to integer). */
    public function balance(User $user): array
    {
        $wallet = $this->wallet($user);

        return [
            'balance' => intdiv((int) $wallet->balance_kopecks, 100),
            'balance_kopecks' => (int) $wallet->balance_kopecks,
            'held_kopecks' => (int) $wallet->held_kopecks,
            'currency' => config('billing.currency', 'RUB'),
        ];
    }

    public function credit(
        User $user,
        int $amountKopecks,
        WalletTransactionType $type,
        ?string $description = null,
        ?string $refType = null,
        ?int $refId = null,
        ?string $idempotencyKey = null,
    ): WalletTransaction {
        return $this->apply($user, abs($amountKopecks), $type, $description, $refType, $refId, $idempotencyKey);
    }

    public function debit(
        User $user,
        int $amountKopecks,
        WalletTransactionType $type,
        ?string $description = null,
        ?string $refType = null,
        ?int $refId = null,
        ?string $idempotencyKey = null,
    ): WalletTransaction {
        return $this->apply($user, -abs($amountKopecks), $type, $description, $refType, $refId, $idempotencyKey);
    }

    /**
     * Move funds from the spendable balance into escrow hold.
     */
    public function hold(
        User $user,
        int $amountKopecks,
        WalletTransactionType $type = WalletTransactionType::SafeDealHold,
        ?string $description = null,
        ?string $refType = null,
        ?int $refId = null,
        ?string $idempotencyKey = null,
    ): WalletTransaction {
        $amountKopecks = abs($amountKopecks);

        return DB::transaction(function () use ($user, $amountKopecks, $type, $description, $refType, $refId, $idempotencyKey) {
            $wallet = $this->lock($user);

            if ((int) $wallet->balance_kopecks < $amountKopecks) {
                throw new InsufficientFundsException;
            }

            $tx = $this->recordLocked($wallet, -$amountKopecks, $type, $description, $refType, $refId, $idempotencyKey);

            $wallet->held_kopecks = (int) $wallet->held_kopecks + $amountKopecks;
            $wallet->save();

            return $tx;
        });
    }

    /**
     * Release held funds (consume the hold). Does not touch spendable balance;
     * the buyer already paid at hold time.
     */
    public function consumeHold(User $user, int $amountKopecks): void
    {
        $amountKopecks = abs($amountKopecks);

        DB::transaction(function () use ($user, $amountKopecks): void {
            $wallet = $this->lock($user);
            $wallet->held_kopecks = max(0, (int) $wallet->held_kopecks - $amountKopecks);
            $wallet->save();
        });
    }

    /**
     * Return held funds to the spendable balance (dispute refund / cancel).
     */
    public function refundHold(
        User $user,
        int $amountKopecks,
        WalletTransactionType $type = WalletTransactionType::SafeDealRefund,
        ?string $description = null,
        ?string $refType = null,
        ?int $refId = null,
        ?string $idempotencyKey = null,
    ): WalletTransaction {
        $amountKopecks = abs($amountKopecks);

        return DB::transaction(function () use ($user, $amountKopecks, $type, $description, $refType, $refId, $idempotencyKey) {
            $wallet = $this->lock($user);
            $tx = $this->recordLocked($wallet, $amountKopecks, $type, $description, $refType, $refId, $idempotencyKey);
            $wallet->held_kopecks = max(0, (int) $wallet->held_kopecks - $amountKopecks);
            $wallet->save();

            return $tx;
        });
    }

    private function apply(
        User $user,
        int $signedAmount,
        WalletTransactionType $type,
        ?string $description,
        ?string $refType,
        ?int $refId,
        ?string $idempotencyKey,
    ): WalletTransaction {
        return DB::transaction(function () use ($user, $signedAmount, $type, $description, $refType, $refId, $idempotencyKey) {
            if ($idempotencyKey) {
                $existing = WalletTransaction::query()->where('idempotency_key', $idempotencyKey)->first();
                if ($existing) {
                    return $existing;
                }
            }

            $wallet = $this->lock($user);

            if ($signedAmount < 0 && (int) $wallet->balance_kopecks < abs($signedAmount)) {
                throw new InsufficientFundsException;
            }

            return $this->recordLocked($wallet, $signedAmount, $type, $description, $refType, $refId, $idempotencyKey);
        });
    }

    private function lock(User $user): Wallet
    {
        $this->wallet($user);

        return Wallet::query()->where('user_id', $user->id)->lockForUpdate()->firstOrFail();
    }

    private function recordLocked(
        Wallet $wallet,
        int $signedAmount,
        WalletTransactionType $type,
        ?string $description,
        ?string $refType,
        ?int $refId,
        ?string $idempotencyKey,
    ): WalletTransaction {
        $before = (int) $wallet->balance_kopecks;
        $after = $before + $signedAmount;

        $wallet->balance_kopecks = $after;
        $wallet->version = (int) $wallet->version + 1;
        $wallet->save();

        return WalletTransaction::query()->create([
            'wallet_id' => $wallet->id,
            'user_id' => $wallet->user_id,
            'type' => $type,
            'amount_kopecks' => $signedAmount,
            'balance_before' => $before,
            'balance_after' => $after,
            'ref_type' => $refType,
            'ref_id' => $refId,
            'idempotency_key' => $idempotencyKey,
            'description' => $description,
            'created_at' => now(),
        ]);
    }

    /**
     * @return array{data: list<array<string, mixed>>, meta: array<string, mixed>}
     */
    public function transactions(User $user, int $perPage = 20): array
    {
        $wallet = $this->wallet($user);

        $paginator = WalletTransaction::query()
            ->where('wallet_id', $wallet->id)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate($perPage);

        return [
            'data' => collect($paginator->items())->map(fn (WalletTransaction $tx) => [
                'id' => (string) $tx->id,
                'type' => $tx->amount_kopecks >= 0 ? 'in' : 'out',
                'amount' => abs((int) $tx->amount_kopecks),
                'amount_rub' => round(abs((int) $tx->amount_kopecks) / 100, 2),
                'balance_after' => (int) $tx->balance_after,
                'kind' => $tx->type->value,
                'title' => $tx->description ?? $tx->type->label(),
                'date' => $tx->created_at?->toIso8601String(),
            ])->all(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'total' => $paginator->total(),
            ],
        ];
    }
}

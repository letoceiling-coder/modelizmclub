<?php

namespace Modules\Billing\Services;

use App\Models\BonusAccount;
use App\Models\BonusTransaction;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

/**
 * Бонусные баллы — отдельный счёт, не деньги.
 *
 * ПОЧЕМУ ЭТОТ КОД ПОЯВИЛСЯ ТОЛЬКО 28.09. Таблицы `bonus_accounts` и
 * `bonus_transactions` стояли с самого начала, но баллов в них не было:
 * `balance` **всегда оставался нулём** — ни один путь во всём `app/` его не
 * увеличивал, единственные обращения создавали строку со `balance => 0`.
 * Журнал при этом использовали не по назначению: в `amount` писали штуки
 * размещений, выданные за приглашение и из админки.
 *
 * Теперь `balance` — это баллы, и он настоящий. Прежние строки журнала с
 * типами `referral` и `admin_grant` остаются как были: они про штуки
 * размещений, и пересчитывать их в баллы означало бы придумать людям
 * баланс, которого им не начисляли.
 *
 * БАЛЛЫ НЕ ДЕНЬГИ. Кошелёк (`wallets`) — рубли, из него есть вывод.
 * Баллы выводу не подлежат, поэтому они живут в своей таблице, своей
 * проводкой и своим типом. Смешение было бы не удобством, а обещанием
 * вывести то, что вывести нельзя.
 *
 * ПОВТОРНОЕ НАЧИСЛЕНИЕ. Ключ идемпотентности обязателен: он пишется в
 * `description` отдельной строкой и проверяется под блокировкой счёта. Без
 * него два одновременных подтверждения телефона начислили бы дважды —
 * `lockForUpdate` на счёте этого сам по себе не ловит, потому что первая
 * проводка ещё не видна второму запросу до её записи.
 */
class BonusPointsService
{
    /** Тип проводки: награда за приглашённого друга. */
    public const TYPE_REFERRAL = 'referral_points';

    /** Тип проводки: начисление или списание из админки. */
    public const TYPE_ADMIN = 'admin_points';

    /** Сколько баллов на счету. Нет счёта — ноль, а не отказ. */
    public function balance(User $user): int
    {
        return (int) (BonusAccount::query()->whereKey($user->id)->value('balance') ?? 0);
    }

    /**
     * Начислить баллы. Возвращает проводку или `null`, если по этому ключу
     * уже начисляли.
     *
     * @param  positive-int  $points
     */
    public function credit(
        User $user,
        int $points,
        string $type,
        string $description,
        ?Model $source = null,
        ?string $idempotencyKey = null,
    ): ?BonusTransaction {
        if ($points <= 0) {
            return null;
        }

        return DB::transaction(function () use ($user, $points, $type, $description, $source, $idempotencyKey) {
            $счёт = BonusAccount::query()->whereKey($user->id)->lockForUpdate()->first();
            if ($счёт === null) {
                BonusAccount::query()->create(['user_id' => $user->id, 'balance' => 0]);
                $счёт = BonusAccount::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();
            }

            if ($idempotencyKey !== null && $this->alreadyDone($user, $idempotencyKey)) {
                return null;
            }

            $счёт->forceFill(['balance' => (int) $счёт->balance + $points])->save();

            return BonusTransaction::query()->create([
                'account_user_id' => $user->id,
                'amount' => $points,
                'type' => $type,
                'source_type' => $source?->getMorphClass(),
                'source_id' => $source?->getKey(),
                'description' => $this->withKey($description, $idempotencyKey),
                'created_at' => now(),
            ]);
        });
    }

    /**
     * Списать баллы. Ниже нуля счёт не уходит: отказ, а не отрицательный
     * баланс — «должен баллов» не значит ничего.
     */
    public function debit(User $user, int $points, string $type, string $description): ?BonusTransaction
    {
        if ($points <= 0) {
            return null;
        }

        return DB::transaction(function () use ($user, $points, $type, $description) {
            $счёт = BonusAccount::query()->whereKey($user->id)->lockForUpdate()->first();
            if ($счёт === null || (int) $счёт->balance < $points) {
                return null;
            }

            $счёт->forceFill(['balance' => (int) $счёт->balance - $points])->save();

            return BonusTransaction::query()->create([
                'account_user_id' => $user->id,
                'amount' => -$points,
                'type' => $type,
                'description' => $description,
                'created_at' => now(),
            ]);
        });
    }

    /**
     * Сколько баллов начислено по типу — для статистики «Бонусов» на
     * странице приглашений.
     *
     * Считается по проводкам, а не по балансу: баланс уменьшается при
     * тратах, а вопрос человека — «сколько я заработал», а не «сколько
     * осталось».
     */
    public function earned(User $user, string $type): int
    {
        return (int) BonusTransaction::query()
            ->where('account_user_id', $user->id)
            ->where('type', $type)
            ->where('amount', '>', 0)
            ->sum('amount');
    }

    /** @return list<BonusTransaction> последние проводки */
    public function history(User $user, int $limit = 20): array
    {
        return BonusTransaction::query()
            ->where('account_user_id', $user->id)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit($limit)
            ->get()
            ->all();
    }

    /**
     * Ключ идемпотентности хранится в `description`.
     *
     * Своей колонки у проводки нет, а заводить её миграцией ради одного
     * признака — менять таблицу, в которой уже лежат чужие строки. Ключ
     * приписывается в конце, в скобках, и ищется точным вхождением.
     */
    private function withKey(string $description, ?string $key): string
    {
        return $key === null ? $description : $description.' ['.$key.']';
    }

    private function alreadyDone(User $user, string $key): bool
    {
        return BonusTransaction::query()
            ->where('account_user_id', $user->id)
            ->where('description', 'like', '%['.$key.']')
            ->exists();
    }
}

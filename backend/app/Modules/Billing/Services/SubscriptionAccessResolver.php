<?php

namespace Modules\Billing\Services;

use App\Models\Payment;
use App\Models\User;
use App\Models\UserSubscription;
use App\Support\FirstHundredPromo;
use Illuminate\Support\Collection;

/**
 * Считает основание доступа — для одного человека и для страницы сразу.
 *
 * ПОЧЕМУ ПАКЕТОМ, А НЕ ТОЛЬКО ПОШТУЧНО. `User::hasActiveSubscription()`
 * делает до трёх запросов: строка подписки, оплата, выдача руками. В списке
 * пользователей админки на странице двадцать пять человек — это до
 * семидесяти пяти лишних запросов на страницу. Починить ложь в интерфейсе и
 * завести взамен N+1 значило бы обменять один дефект из аудита 03.10 на
 * другой из того же списка.
 *
 * Поэтому у резолвера два входа. `forUser()` — для ответа об одном человеке,
 * там три запроса и есть правильная цена. `forUsers()` — три запроса на
 * всю страницу, сколько бы в ней ни было строк; дальше `UserResource` берёт
 * готовое.
 *
 * Правила доступа здесь не живут: их источник — `hasActiveSubscription()`,
 * и порядок оснований тот же. Если он изменится, менять надо там, а здесь
 * сломается проверка `SubscriptionAccessMatchesGateTest` — она сверяет оба
 * пути на одних и тех же людях.
 */
class SubscriptionAccessResolver
{
    /**
     * Память на запрос: страницу прогревает контроллер одним `forUsers()`,
     * дальше `UserResource` спрашивает по одному и получает готовое.
     *
     * Класс связан в контейнере как `scoped` — то есть один на запрос и
     * новый на следующий. Синглтон на процесс здесь был бы ошибкой: процесс
     * php-fpm живёт сутками, и ответ одному посетителю не должен зависеть от
     * предыдущего (см. CLAUDE.md про модульное состояние на сервере).
     *
     * @var array<int, SubscriptionAccess>
     */
    private array $память = [];

    public function forUser(User $user): SubscriptionAccess
    {
        $id = (int) $user->id;

        if (isset($this->память[$id])) {
            return $this->память[$id];
        }

        return $this->forUsers(collect([$user]))[$id]
            ?? SubscriptionAccess::make(false, SubscriptionAccess::НЕТ_СТРОКИ, null);
    }

    /** Сбросить память — нужно после записи, иначе ответ покажет прежнее. */
    public function forget(int $userId): void
    {
        unset($this->память[$userId]);
    }

    /**
     * @param  Collection<int, User>  $users
     * @return array<int, SubscriptionAccess>
     */
    public function forUsers(Collection $users): array
    {
        $ids = $users->pluck('id')->map(fn ($id) => (int) $id)->all();

        if ($ids === []) {
            return [];
        }

        $строки = $this->последниеСтроки($ids);
        $оплатившие = $this->оплатившие($ids);
        $покрытыеПромо = $this->покрытыеПромо($users);

        $итог = [];

        foreach ($users as $user) {
            $id = (int) $user->id;
            $строка = $строки[$id] ?? null;

            /*
             * Порядок в точности как в `hasActiveSubscription()`:
             * освобождение — вне строки вообще, дальше строка должна быть
             * живой и непросроченной, и только потом ищется основание.
             */
            if ($user->subscription_exempt) {
                $итог[$id] = SubscriptionAccess::make(true, SubscriptionAccess::ОСВОБОЖДЁН, $строка);

                continue;
            }

            if ($строка === null) {
                $итог[$id] = SubscriptionAccess::make(false, SubscriptionAccess::НЕТ_СТРОКИ, null);

                continue;
            }

            if (! $this->живаяИНепросроченная($строка)) {
                $итог[$id] = SubscriptionAccess::make(false, (string) $строка->status, $строка);

                continue;
            }

            if (isset($оплатившие[$id])) {
                $итог[$id] = SubscriptionAccess::make(true, SubscriptionAccess::ОПЛАЧЕНО, $строка);

                continue;
            }

            if ($строка->granted_by_admin_id !== null) {
                $итог[$id] = SubscriptionAccess::make(true, SubscriptionAccess::ВЫДАНА, $строка);

                continue;
            }

            if ($user->is_first_hundred && ($user->promo_pool_id || isset($покрытыеПромо[$id]))) {
                $итог[$id] = SubscriptionAccess::make(true, SubscriptionAccess::ПЕРВАЯ_СОТНЯ, $строка);

                continue;
            }

            $итог[$id] = SubscriptionAccess::make(false, SubscriptionAccess::БЕЗ_ОСНОВАНИЯ, $строка);
        }

        $this->память = $итог + $this->память;

        return $итог;
    }

    /**
     * Последняя строка на человека — тем же порядком, что берут все четыре
     * прежние сводки: по `ends_at`, затем по `id`.
     *
     * @param  list<int>  $ids
     * @return array<int, UserSubscription>
     */
    private function последниеСтроки(array $ids): array
    {
        return UserSubscription::query()
            ->whereIn('user_id', $ids)
            ->orderBy('user_id')
            ->orderByDesc('ends_at')
            ->orderByDesc('id')
            ->get()
            ->groupBy('user_id')
            ->map(fn (Collection $строки) => $строки->first())
            ->keyBy(fn (UserSubscription $s) => (int) $s->user_id)
            ->all();
    }

    /**
     * Кто оплатил подписку настоящим шлюзом.
     *
     * Условие — слово в слово из `User::hasPaidSubscriptionPayment()`,
     * включая исключение `stub`: за тестовый эквайринг денег не брали, и
     * пока настоящий шлюз живой, такие оплаты основанием не считаются.
     *
     * @param  list<int>  $ids
     * @return array<int, true>
     */
    private function оплатившие(array $ids): array
    {
        $query = Payment::query()
            ->whereIn('user_id', $ids)
            ->where('status', 'paid')
            ->where(function ($q): void {
                $q->whereNotNull('metadata->plan_id')
                    ->orWhere('metadata->payable_type', 'subscription');
            });

        if (app(PaymentGatewayManager::class)->provider() !== 'stub') {
            $query->where('provider', '!=', 'stub');
        }

        return $query->distinct()->pluck('user_id')
            ->mapWithKeys(fn ($id) => [(int) $id => true])
            ->all();
    }

    /**
     * Промо-покрытие. Список покрытых считается один раз на всю страницу —
     * `FirstHundredPromo::coversUser()` внутри зовёт тот же расчёт на каждого.
     *
     * @param  Collection<int, User>  $users
     * @return array<int, true>
     */
    private function покрытыеПромо(Collection $users): array
    {
        if (! $users->contains(fn (User $u) => (bool) $u->is_first_hundred)) {
            return [];
        }

        $config = FirstHundredPromo::get();

        if (! $config['enabled'] || $config['total'] <= 0) {
            return [];
        }

        return FirstHundredPromo::coveredUserIds($config['total'])
            ->mapWithKeys(fn ($id) => [(int) $id => true])
            ->all();
    }

    private function живаяИНепросроченная(UserSubscription $строка): bool
    {
        return $строка->status === 'active'
            && ($строка->ends_at === null || $строка->ends_at->isFuture());
    }
}

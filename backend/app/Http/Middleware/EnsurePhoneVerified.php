<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Подтверждённый телефон. Решение З2 от 09.10.
 *
 * Стоит ровно на двух вещах, и список закрыт:
 *
 * 1. публикация объявления — `POST /listings`, `POST /listings/{uuid}/publish`;
 * 2. вывод средств — `POST /wallet/withdraw` и реквизиты выплаты
 *    `PUT /account/payout-requisites` (куда уходят деньги — часть вывода).
 *
 * Всё остальное телефона не требует: просмотр чего угодно, сообщества, лента,
 * мессенджер и переписка. До 09.10 требование стояло на 134 маршрутах, и
 * жалобы владельца от 09.10 — прямое следствие: сообщество не посмотреть,
 * мессенджер не открыть, окно подтверждения поверх всего.
 *
 * Список держит сторож `tests/Feature/PhoneRequiredOnlyWhereDecidedTest.php`:
 * появился новый маршрут с этим посредником — проверка падает и требует
 * назвать его вслух. Правило без того, кто за ним следит, через месяц
 * перестаёт быть правилом (см. `CLAUDE.md`, «Доступ к .env»).
 *
 * Пара: `EnsureEmailVerified`.
 */
class EnsurePhoneVerified
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user('sanctum');

        if (! $user) {
            return response()->json(['message' => __('Unauthenticated.')], 401);
        }

        // Сотрудники проходят без подтверждений — как в прежнем посреднике.
        if ($user->isModerator()) {
            return $next($request);
        }

        if ($user->phone_verified_at === null) {
            return response()->json([
                'message' => 'Подтвердите номер телефона по SMS, чтобы выполнить это действие.',
                'code' => 'phone_not_verified',
            ], 403);
        }

        return $next($request);
    }
}

<?php

namespace Modules\Chat\Http\Controllers\Api\V1\Concerns;

use App\Models\Conversation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Проверка права писать в беседу с внятным отказом.
 *
 * Голый authorize() превращает отказ политики в 403 без кода, и клиент
 * показывает его текст тостом. Код отказа нужен, чтобы клиент открыл нужное
 * окно: `subscription_required` — окно подписки, `friendship_required` —
 * «Добавьте пользователя в друзья».
 *
 * Код пробрасывается любой, какой поставила политика, а не выбранный из
 * списка. До 05.10 здесь стояло сравнение ровно с `subscription_required`, и
 * когда у политики появился второй код, отказ по дружбе приехал клиенту
 * пустым 403: окно не открывалось, человек видел общий текст. Перечисление
 * кодов в двух местах — это и есть та вторая копия, которая расходится с
 * первой; теперь решает только политика.
 *
 * Отказ без кода (не участник беседы) остаётся прежним 403 от authorize().
 */
trait AuthorizesSend
{
    protected function denySend(Request $request, Conversation $conversation): ?JsonResponse
    {
        /*
         * Телефон для переписки не нужен — ни по объявлению, ни в любой
         * другой беседе. Решение З2 от 09.10.
         *
         * Сужение «кроме переписки по объявлению» появилось 09.10 по решению
         * Ж3 и держалось на том, что во всех остальных беседах телефон всё
         * ещё требуется. З2 это требование снял целиком, и различать беседы
         * стало незачем: проверка смотрит только почту, одинаково для всех.
         */
        if ($отказ = $this->denyUnverifiedSender($request)) {
            return $отказ;
        }

        $verdict = Gate::forUser($request->user())->inspect('send', $conversation);

        if ($verdict->allowed()) {
            return null;
        }

        if ($verdict->code()) {
            return response()->json([
                'message' => $verdict->message(),
                'code' => $verdict->code(),
            ], 403);
        }

        $verdict->authorize();

        return null;
    }

    /** Только почта: телефон по решению З2 для переписки не требуется. */
    private function denyUnverifiedSender(Request $request): ?JsonResponse
    {
        $user = $request->user();

        if ($user === null || $user->isModerator()) {
            return null;
        }

        if ($user->requiresEmailVerification()) {
            return response()->json([
                'message' => 'Подтвердите email, чтобы выполнить это действие.',
                'code' => 'email_not_verified',
            ], 403);
        }

        return null;
    }
}

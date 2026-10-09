<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Подтверждённая почта. Про телефон здесь ничего нет.
 *
 * До 09.10 этих двух условий не существовало раздельно: один посредник
 * `EnsureFullyVerified` требовал и почту, и телефон, и стоял на 134
 * маршрутах — от публикации объявления до пометки уведомления прочитанным.
 *
 * Решение З2 от 09.10 оставляет требование телефона ровно за двумя
 * действиями: публикация объявления и вывод средств. Но требование **почты**
 * решение не трогает, и снять его вместе с телефоном было бы подменой
 * решения. Поэтому посредник разделён на два, и на прежних маршрутах стоит
 * этот — почтовый.
 *
 * Пара: `EnsurePhoneVerified`.
 */
class EnsureEmailVerified
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user('sanctum');

        if (! $user) {
            return response()->json(['message' => __('Unauthenticated.')], 401);
        }

        /*
         * Сотрудники проходят без подтверждений — как и раньше.
         *
         * Это поведение жило в `User::isFullyVerified()`, и при разделении
         * посредника его надо было повторить явно, иначе модератор упёрся бы
         * в подтверждение почты на своих же маршрутах.
         */
        if ($user->isModerator()) {
            return $next($request);
        }

        if ($user->requiresEmailVerification()) {
            return response()->json([
                'message' => 'Подтвердите email, чтобы выполнить это действие.',
                'code' => 'email_not_verified',
            ], 403);
        }

        return $next($request);
    }
}

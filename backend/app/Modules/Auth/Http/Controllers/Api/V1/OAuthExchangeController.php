<?php

namespace Modules\Auth\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Auth\Services\OAuthHandoffService;

/**
 * Обмен разового кода входа на токен.
 *
 * Вторая половина починки «токен не едет в адресной строке»: провайдер
 * возвращает человека на `/login?oauth_code=…`, страница обменивает код
 * здесь и получает токен в теле ответа. Разбор целиком — в
 * `OAuthHandoffService`.
 *
 * Без авторизации по построению: до обмена токена у клиента и нет. Защита —
 * сам код: 64 случайных знака, две минуты жизни, гасится первым обменом.
 * Плюс ограничитель частоты на маршруте.
 */
class OAuthExchangeController extends Controller
{
    public function __invoke(Request $request, OAuthHandoffService $handoff): JsonResponse
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:128'],
        ]);

        $token = $handoff->claim($data['code']);

        if ($token === null) {
            /*
             * Один ответ на всё: кода не было, истёк, уже обменян. Различать
             * эти случаи наружу незачем, а клиенту во всех трёх делать одно
             * и то же — отправлять человека входить заново.
             */
            return response()->json([
                'message' => 'Ссылка входа уже использована или устарела. Войдите снова.',
                'code' => 'oauth_code_invalid',
            ], 422);
        }

        return response()->json(['data' => ['token' => $token]])
            ->header('Cache-Control', 'no-store');
    }
}

<?php

namespace Modules\Auth\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Modules\Auth\Services\MaxAuthService;

/**
 * Приёмник обновлений бота MAX. Единственный вход, которому доверяют номер
 * телефона, — и потому преграда перед ним должна быть закрытой по умолчанию.
 *
 * Ненастроенный секрет закрывает адрес, а не открывает. До 03.10 условие было
 * обратным: `if ($secret !== '')` снимало проверку целиком, когда секрета нет.
 * А снять его нечаянно легко: `env()` отдаёт null, если `.env` не читается, и
 * ровно это случилось 07.09 после `config:clear` от www-data (раздел «Доступ
 * к .env на проде»). Там цена была шесть минут простоя; здесь — вход в любую
 * учётку по известному номеру. Подделкой `bot_started` и `message_created`
 * сессия доводится до `completeLogin`, а тот кладёт в неё токен владельца
 * номера, и `GET /auth/oauth/max/status` его отдаёт.
 *
 * Подлинность номера внутри обновления подписью не покрыта — см. разбор в
 * `MaxAuthService::onContactShared`. То есть этот секрет не один из двух
 * замков, а единственный.
 *
 * `RegisterMaxWebhookCommand` с пустым секретом подписку не регистрирует, так
 * что пустое значение здесь означает «настройка не доведена до конца», а не
 * рабочий режим.
 */
class MaxWebhookController extends Controller
{
    /** Заголовок с общим секретом; имя задаёт MAX. */
    public const SECRET_HEADER = 'X-Max-Bot-Api-Secret';

    public function __invoke(Request $request, MaxAuthService $max): JsonResponse
    {
        $secret = (string) config('services.max.webhook_secret');

        if ($secret === '') {
            Log::warning('Вебхук MAX закрыт: секрет не настроен', ['ip' => $request->ip()]);

            return response()->json(['message' => __('Not found.')], 404);
        }

        $header = (string) $request->header(self::SECRET_HEADER, '');

        if (! hash_equals($secret, $header)) {
            Log::warning('MAX webhook rejected: bad secret', ['ip' => $request->ip()]);

            return response()->json(['message' => __('Unauthorized.')], 401);
        }

        try {
            $max->handleWebhook($request->all());
        } catch (\Throwable $e) {
            report($e);
        }

        return response()->json(['ok' => true]);
    }
}

<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;

/**
 * Приёмник отчётов Content-Security-Policy.
 *
 * Политика включена в режиме отчёта: браузер ничего не блокирует, но
 * присылает сюда то, что заблокировал бы. Пока эти отчёты не собраны и не
 * разобраны, включать политику всерьёз нельзя — CSP ломает сайт молча и
 * целиком, и узнать об этом от пользователей получится не сразу.
 *
 * Открыт без авторизации по построению: отчёт шлёт браузер, а не приложение,
 * и токена у него нет. Отсюда два ограничения.
 *
 * Первое — частота. Адрес общедоступен, и залить журнал мусором может кто
 * угодно; ограничитель стоит на маршруте.
 *
 * Второе — размер. Тело отчёта пишется в журнал, поэтому обрезается: в
 * поле script-sample браузер кладёт кусок исходника, и на минифицированном
 * бандле это бывают килобайты.
 *
 * Ответ всегда 204 и всегда пустой. Браузеру нечего делать с ошибкой, а
 * подробный ответ на анонимный адрес — лишняя подсказка тому, кто его
 * изучает.
 */
class CspReportController extends Controller
{
    /** Больше этого в одном отчёте нам не нужно и в журнал не помещается. */
    private const MAX_BYTES = 4096;

    public function __invoke(Request $request): Response
    {
        $raw = substr($request->getContent(), 0, self::MAX_BYTES);

        if ($raw !== '') {
            $decoded = json_decode($raw, true);

            Log::channel('csp')->info('csp-violation', [
                'report' => is_array($decoded) ? $decoded : $raw,
                'ip' => $request->ip(),
                'ua' => substr((string) $request->userAgent(), 0, 256),
            ]);
        }

        return response()->noContent();
    }
}

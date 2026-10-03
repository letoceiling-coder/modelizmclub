<?php

namespace Modules\Billing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Modules\Billing\Services\SafeDealPayoutService;

/**
 * VTB ОЭ callbacks for seller payouts (SBP_B2C_PAYMENT_AUTHORIZE / _FINAL).
 *
 * The callback body is advisory: we record it, then re-read the payout from the
 * bank so a spoofed call cannot mark money as paid.
 *
 * Но «не доверяем телу» тут не всё. `advance()` вызывает
 * `confirmTransaction()` — то есть подтверждает выплату продавцу в банке.
 * Это настоящее движение денег, и до 03.10 единственной защитой адреса была
 * случайность `request_id`: подписи не было, а `Limit::none()` снимал и
 * ограничение частоты. Защита по совпадению, не по замыслу — при утечке
 * `request_id` в логи, выгрузку или переписку с поддержкой адрес становился
 * кнопкой «подтвердить выплату» без всякого входа.
 *
 * Теперь общий секрет в заголовке, как у вебхука доставки. Ненастроенный
 * секрет закрывает адрес: выплаты от этого не встают, их и так двигает
 * `safe-deals:auto-release` каждые 15 минут (`routes/console.php`), — а вот
 * тихо принимать подтверждения выплат от кого попало нельзя.
 */
class SafeDealPayoutWebhookController extends Controller
{
    /** Заголовок с общим секретом. */
    public const SIGNATURE_HEADER = 'X-Payout-Signature';

    public function __invoke(Request $request, SafeDealPayoutService $payouts): JsonResponse
    {
        $secret = (string) config('billing.safe_deal.payout_webhook_secret');

        if ($secret === '') {
            Log::warning('Вебхук выплат закрыт: секрет не настроен', ['ip' => $request->ip()]);

            return response()->json(['message' => __('Not found.')], 404);
        }

        $header = (string) $request->header(self::SIGNATURE_HEADER, '');

        if (! hash_equals($secret, $header)) {
            Log::warning('Вебхук выплат отклонён: неверная подпись', ['ip' => $request->ip()]);

            return response()->json(['message' => __('Unauthorized.')], 401);
        }

        $requestId = (string) ($request->input('requestId') ?? $request->input('request_id') ?? '');

        if ($requestId === '') {
            // Ключи, не тело: тело приходит из платёжного контура выплат.
            Log::warning('SafeDeal payout webhook without requestId', [
                'ключи' => array_keys($request->all()),
                'ip' => $request->ip(),
            ]);

            return response()->json(['status' => 'ignored']);
        }

        $payout = $payouts->findByRequestId($requestId);

        if ($payout === null) {
            Log::warning('SafeDeal payout webhook: unknown requestId', ['requestId' => $requestId]);

            return response()->json(['status' => 'ignored']);
        }

        $payouts->advance($payout);

        return response()->json(['status' => 'ok']);
    }
}

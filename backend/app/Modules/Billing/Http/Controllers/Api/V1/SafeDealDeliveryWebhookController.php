<?php

namespace Modules\Billing\Http\Controllers\Api\V1;

use App\Enums\SafeDealStatus;
use App\Http\Controllers\Controller;
use App\Models\SafeDeal;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Modules\Billing\Services\SafeDealService;

/**
 * Delivery provider webhook (spec v4.0 §T5): when a parcel is delivered we
 * flip the safe deal to `delivered` and start the auto-release timer.
 *
 * Тело этого вызова доверенное — в отличие от вебхуков ВТБ и СДЭК, которые
 * берут из тела только идентификатор и перечитывают состояние у провайдера.
 * Здесь перечитывать не у кого: адрес общий, провайдер заранее не известен.
 * Значит доверять телу можно только после проверки общего секрета.
 *
 * Без секрета вызов отбивается. Номер отправления не тайна — он напечатан
 * на этикетке и отдаётся обеим сторонам в `ShipmentResource`, — а отметка
 * о доставке заводит `auto_release_at` и через `auto_release_days` отдаёт
 * деньги продавцу. То есть открытый адрес позволял продавцу забрать оплату,
 * не отправив посылку. Найдено аудитом 26.09.
 *
 * Ненастроенный секрет закрывает адрес, а не открывает: забытый ключ должен
 * ломать приём уведомлений заметно, а не молча пропускать чужие.
 */
class SafeDealDeliveryWebhookController extends Controller
{
    /** Заголовок с общим секретом. */
    public const SIGNATURE_HEADER = 'X-Delivery-Signature';

    public function __invoke(Request $request, SafeDealService $deals): JsonResponse
    {
        $secret = (string) config('billing.safe_deal.delivery_webhook_secret');

        if ($secret === '') {
            Log::warning('Вебхук доставки закрыт: секрет не настроен', ['ip' => $request->ip()]);

            return response()->json(['message' => 'Not found.'], 404);
        }

        $header = (string) $request->header(self::SIGNATURE_HEADER, '');

        if (! hash_equals($secret, $header)) {
            Log::warning('Вебхук доставки отклонён: неверная подпись', ['ip' => $request->ip()]);

            return response()->json(['message' => 'Unauthorized.'], 401);
        }

        $tracking = (string) $request->input('tracking_number', '');
        $status = (string) $request->input('status', '');

        if ($tracking === '') {
            Log::warning('Safe deal delivery webhook without tracking number', $request->all());

            return response()->json(['status' => 'ignored'], 202);
        }

        $deal = SafeDeal::query()
            ->where('tracking_number', $tracking)
            ->whereIn('status', [SafeDealStatus::Paid->value, SafeDealStatus::Shipped->value])
            ->first();

        if (! $deal) {
            return response()->json(['status' => 'not_found'], 202);
        }

        if (in_array(strtolower($status), ['delivered', 'received', 'completed'], true)) {
            $deals->markDelivered($deal, null, "Провайдер доставки: {$status}");
        }

        return response()->json(['status' => 'ok']);
    }
}

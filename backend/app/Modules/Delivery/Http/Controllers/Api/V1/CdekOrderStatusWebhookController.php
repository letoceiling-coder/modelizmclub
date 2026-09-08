<?php

namespace Modules\Delivery\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Shipment;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Delivery\Services\ShipmentService;

#[Group('Delivery — Webhooks', weight: 54)]
class CdekOrderStatusWebhookController extends Controller
{
    public function __invoke(Request $request, ShipmentService $shipments): JsonResponse
    {
        $payload = $request->all();
        $uuid = data_get($payload, 'uuid') ?? data_get($payload, 'entity.uuid');
        $cdekNumber = data_get($payload, 'cdek_number') ?? data_get($payload, 'entity.cdek_number');
        $status = data_get($payload, 'status.code')
            ?? data_get($payload, 'entity.statuses.0.code')
            ?? data_get($payload, 'attributes.code');

        /*
         * Без опознавательных данных отправление не выбирается.
         *
         * Вложенный `where` ниже при пустом теле не добавлял ни одного
         * условия, и запрос вырождался в «первое попавшееся отправление
         * СДЭК». Дальше по нему шёл `syncStatus` — то есть обращение к
         * внешнему API и запись статуса в чужую строку. Вызвать это мог
         * кто угодно: подписи у колбэков СДЭК нет, тело `{}` достаточно.
         *
         * Само по себе это тянуло на мелочь, пока путь считался общим
         * лимитом: 120 запросов в минуту с адреса — потолок, за который
         * не выйти. Теперь путь из лимита исключён (иначе часть настоящих
         * уведомлений теряется), и потолка больше нет — значит, сторожить
         * должен сам обработчик.
         */
        if (! $uuid && ! $cdekNumber) {
            return response()->json(['message' => 'ignored'], 200);
        }

        $shipment = Shipment::query()
            ->where('provider', 'cdek')
            ->where(function ($q) use ($uuid, $cdekNumber): void {
                if ($uuid) {
                    $q->where('external_id', (string) $uuid);
                }
                if ($cdekNumber) {
                    $q->orWhere('tracking_number', (string) $cdekNumber);
                }
            })
            ->first();

        if ($shipment === null) {
            return response()->json(['message' => 'ignored'], 200);
        }

        if (! is_string($status) || $status === '') {
            $shipments->syncStatus($shipment);

            return response()->json(['message' => 'ok', 'synced' => true], 200);
        }

        $shipments->applyWebhookUpdate(
            $shipment,
            $status,
            $cdekNumber !== null ? (string) $cdekNumber : null,
            $payload,
        );

        return response()->json(['message' => 'ok'], 200);
    }
}

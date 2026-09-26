<?php

namespace Modules\Delivery\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Shipment;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Modules\Delivery\Services\ShipmentService;

#[Group('Delivery — Webhooks', weight: 54)]
class CdekOrderStatusWebhookController extends Controller
{
    /** Ключ отметки о первом уведомлении, пришедшем от СДЭК. */
    private const ОТМЕТКА = 'cdek:webhook:first-seen-at';

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
            // Отметка о первом уведомлении ставится ниже, уже после этой
            // проверки. Пустое тело на этот адрес шлёт кто угодно — свой же
            // `curl` при проверке, чужой сканер, — и считать такое «первым
            // уведомлением от СДЭК» значит сжечь отметку на шуме.
            Log::warning('СДЭК: обращение без опознавательных данных', [
                'ключи' => array_keys($payload),
                'ip' => $request->ip(),
            ]);

            return response()->json(['message' => 'ignored'], 200);
        }

        $this->отметить($request, $uuid, $cdekNumber, $status);

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
            // Худший из тихих случаев: СДЭК звонит, а отправления под этими
            // приметами у нас нет. Молча это выглядит ровно как «вебхуки не
            // работают», хотя работают — не сходятся ключи.
            Log::warning('СДЭК: отправление по уведомлению не найдено', [
                'uuid' => $uuid,
                'cdek_number' => $cdekNumber,
                'status' => $status,
            ]);

            return response()->json(['message' => 'ignored'], 200);
        }

        /*
         * Статус из тела не берётся — он только повод перечитать у СДЭК.
         *
         * Подписи у колбэков СДЭК нет, адрес открыт и намеренно исключён из
         * общего лимита. Пока статус принимался из тела, до 26.09, этого было
         * достаточно, чтобы пометить посылку доставленной: дальше
         * `applyWebhookUpdate` → `syncFromShipment` → `markDelivered` заводил
         * `auto_release_at`, и через `auto_release_days` деньги уходили
         * продавцу. Ключи отбора — трек-номер и `external_id`, оба не тайна:
         * отдаются обеим сторонам в `ShipmentResource`, трек ещё и напечатан
         * на этикетке.
         *
         * Теперь подделка даёт максимум лишнее перечитывание — ровно та же
         * расстановка, что у вебхуков ВТБ.
         */
        $shipments->syncStatus($shipment);

        return response()->json(['message' => 'ok', 'synced' => true], 200);
    }

    /**
     * Записать приход уведомления, а первое за всё время — так, чтобы
     * его нельзя было не заметить.
     *
     * Зачем: на 22.09 подписка в СДЭК была заведена, но ни одного
     * уведомления не приходило — и узнать это удалось только раскопками
     * в журналах nginx, потому что обработчик не писал ни строки. Первое
     * настоящее уведомление — событие, которого ждали месяц; оно должно
     * быть видно сразу, а не подтверждаться поиском постфактум.
     *
     * Отметка живёт в кеше и переживает выкатку, но не чистку кеша. Это
     * осознанно: потерянная отметка стоит одной лишней строки `warning`
     * в журнале, а хранить ради неё колонку в базе — дороже вопроса.
     */
    private function отметить(Request $request, mixed $uuid, mixed $cdekNumber, mixed $status): void
    {
        $запись = [
            'uuid' => $uuid,
            'cdek_number' => $cdekNumber,
            'status' => $status,
            'ip' => $request->ip(),
        ];

        if (Cache::get(self::ОТМЕТКА) === null) {
            Cache::forever(self::ОТМЕТКА, now()->toIso8601String());
            Log::warning('СДЭК: пришло ПЕРВОЕ уведомление о статусе отправления', $запись);

            return;
        }

        Log::info('СДЭК: уведомление о статусе отправления', $запись);
    }
}

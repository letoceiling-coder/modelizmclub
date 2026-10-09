<?php

namespace Modules\Delivery\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Dedoc\Scramble\Attributes\Group;
use Dedoc\Scramble\Attributes\QueryParameter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Delivery\Services\Carriers\YandexDeliveryAdapter;
use Modules\Delivery\Services\DeliveryCarrierRegistry;

#[Group('Delivery — Yandex', weight: 52)]
class YandexPickupPointsController extends Controller
{
    /**
     * Место обязательно: без него Яндекс отдаёт пункты выдачи по всей стране.
     *
     * Замер прода 09.10: `GET /delivery/yandex/pickup-points` без параметров
     * заканчивался `PHP Fatal error: Allowed memory size of 134217728 bytes
     * exhausted in Illuminate/Http/Client/Response.php:81` — обработчик
     * php-fpm умирал на разборе ответа, наружу уходил пустой 500. Адрес
     * открыт гостю, то есть один и тот же запрос мог повторять кто угодно без
     * входа, тратя и обработчики, и квоту нашего ключа Яндекса.
     *
     * Соседний СДЭК так себя и ведёт: `city_code` у него `required`, и
     * запрос без города отвечает 422 за миллисекунды. Здесь то же правило,
     * только мест два — числовой `geo_id` либо пара координат.
     */
    #[QueryParameter('geo_id', description: 'Geo ID населённого пункта; обязателен, если не заданы координаты', example: 213)]
    public function __invoke(Request $request, DeliveryCarrierRegistry $registry): JsonResponse
    {
        $registry->assertEnabled('yandex');

        $filters = $request->validate([
            'geo_id' => ['required_without_all:latitude,longitude', 'nullable', 'integer'],
            'latitude' => ['required_with:longitude', 'nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['required_with:latitude', 'nullable', 'numeric', 'between:-180,180'],
            'available_for_dropoff' => ['nullable', 'boolean'],
        ], [
            'geo_id.required_without_all' => 'Укажите город или координаты.',
        ]);

        $adapter = app(YandexDeliveryAdapter::class);

        return response()->json([
            'data' => $adapter->listPickupPoints($filters),
        ]);
    }
}

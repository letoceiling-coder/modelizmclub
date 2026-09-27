<?php

namespace Modules\Delivery\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Support\CdekReadiness;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Delivery\Http\Resources\SellerDeliveryProfileResource;
use Modules\Delivery\Services\SellerDeliveryProfileService;

#[Group('Delivery — Seller profile', weight: 50)]
class IndexSellerDeliveryProfileController extends Controller
{
    public function __invoke(Request $request, SellerDeliveryProfileService $profiles): JsonResponse
    {
        $items = $profiles->listForUser($request->user());

        return response()->json([
            'data' => SellerDeliveryProfileResource::collection($items),
            /*
             * Готов ли человек отправлять СДЭК — одним словом, с сервера.
             *
             * Форма объявления спрашивает это, чтобы сказать продавцу про
             * пункт отправки **до** того, как он заполнит объявление и
             * получит отказ при сохранении. Считать ответ на фронтенде по
             * списку профилей было бы вторым ответом на один вопрос: условий
             * три — перевозчик, активность и собранный снимок точки, — и
             * правка любого развела бы форму с карточкой.
             *
             * Здесь тот же `CdekReadiness`, которым отвечают карточка
             * объявления и проверка при сохранении.
             */
            'meta' => [
                'cdek_ready' => CdekReadiness::userHasPoint((int) $request->user()->id),
            ],
        ]);
    }
}

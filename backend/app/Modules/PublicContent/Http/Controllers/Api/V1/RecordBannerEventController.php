<?php

namespace Modules\PublicContent\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Banner;
use App\Models\BannerEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class RecordBannerEventController extends Controller
{
    public function __invoke(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'event' => ['required', 'string', 'in:impression,click'],
        ]);

        $banner = Banner::query()->find($id);
        if (! $banner) {
            throw new NotFoundHttpException('Баннер не найден.');
        }

        BannerEvent::query()->create([
            'banner_id' => $banner->id,
            'event' => $validated['event'],
            'user_id' => $request->user()?->id,
            'ip_address' => $request->ip(),
        ]);

        /*
         * `increment` уже обновляет модель в памяти — перечитывать её из базы
         * незачем, а `fresh()` стоял здесь дважды, то есть на каждый показ
         * баннера уходило два лишних SELECT.
         *
         * Путь горячий: на проде 17 705 вставок в banner_events и 18 016
         * обновлений banners при 48 строках в таблице. То есть на каждый
         * показ приходилось пять обращений к базе вместо трёх.
         */
        $banner->increment($validated['event'] === 'impression' ? 'impressions_count' : 'clicks_count');

        return response()->json([
            'data' => [
                'impressions_count' => (int) $banner->impressions_count,
                'clicks_count' => (int) $banner->clicks_count,
            ],
        ]);
    }
}

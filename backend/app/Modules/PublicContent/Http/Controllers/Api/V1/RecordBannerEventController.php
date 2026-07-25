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

        if ($validated['event'] === 'impression') {
            $banner->increment('impressions_count');
        } else {
            $banner->increment('clicks_count');
        }

        return response()->json([
            'data' => [
                'impressions_count' => $banner->fresh()->impressions_count,
                'clicks_count' => $banner->fresh()->clicks_count,
            ],
        ]);
    }
}

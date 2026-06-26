<?php

namespace Modules\PublicContent\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SystemSetting;
use Illuminate\Http\JsonResponse;

class StatsController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $firstHundred = SystemSetting::query()->where('key', 'first_hundred_stats')->value('value');

        return response()->json([
            'data' => [
                'first_hundred' => is_array($firstHundred) ? $firstHundred : ['taken' => 0, 'total' => 100],
            ],
        ]);
    }
}

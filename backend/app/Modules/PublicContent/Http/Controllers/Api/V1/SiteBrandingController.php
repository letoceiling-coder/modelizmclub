<?php

namespace Modules\PublicContent\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SystemSetting;
use App\Support\SiteBranding;
use Illuminate\Http\JsonResponse;

class SiteBrandingController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $raw = SystemSetting::query()
            ->where('key', SiteBranding::SETTING_KEY)
            ->value('value');

        return response()->json([
            'data' => SiteBranding::publicPayload(is_array($raw) ? $raw : null),
        ]);
    }
}

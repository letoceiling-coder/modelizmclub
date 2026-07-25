<?php

namespace Modules\PublicContent\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SystemSetting;
use App\Support\FooterContacts;
use Illuminate\Http\JsonResponse;

class FooterContactsController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $raw = SystemSetting::query()
            ->where('key', FooterContacts::SETTING_KEY)
            ->value('value');

        return response()->json([
            'data' => FooterContacts::publicPayload(is_array($raw) ? $raw : null),
        ]);
    }
}

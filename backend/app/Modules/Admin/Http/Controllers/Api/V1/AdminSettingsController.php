<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SystemSetting;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Modules\Admin\Http\Requests\UpdateSettingsRequest;
use Modules\Admin\Services\AuditService;

#[Group('Admin — System', weight: 80)]
class AdminSettingsController extends Controller
{
    public function index(): JsonResponse
    {
        $settings = SystemSetting::query()->orderBy('group')->orderBy('key')->get();

        return response()->json(['data' => $settings]);
    }

    public function update(UpdateSettingsRequest $request, AuditService $audit): JsonResponse
    {
        $updated = [];

        foreach ($request->validated('settings') as $row) {
            $setting = SystemSetting::query()->updateOrCreate(
                ['key' => $row['key']],
                [
                    'value' => $row['value'],
                    'group' => $row['group'] ?? 'general',
                ],
            );
            $updated[] = $setting;
        }

        $audit->log($request->user(), 'admin.settings.update', null, null, ['keys' => collect($updated)->pluck('key')], $request);

        return response()->json(['data' => $updated]);
    }
}

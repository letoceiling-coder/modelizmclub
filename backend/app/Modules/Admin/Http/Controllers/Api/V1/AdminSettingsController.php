<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SystemSetting;
use Dedoc\Scramble\Attributes\BodyParameter;
use Dedoc\Scramble\Attributes\Endpoint;
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

    #[Endpoint(title: 'Обновить настройки')]
    #[BodyParameter('settings', description: 'Массив настроек', example: '[{"key":"site_name","value":{"ru":"ModelizmClub Dev"},"group":"general"}]')]
    public function update(UpdateSettingsRequest $request, AuditService $audit): JsonResponse
    {
        $updated = [];
        $oldValues = [];

        foreach ($request->validated('settings') as $row) {
            // Previous value is kept in the audit log so publications like
            // icon_overrides can be rolled back from /admin (see §26).
            $oldValues[$row['key']] = SystemSetting::query()->where('key', $row['key'])->first()?->value;

            $setting = SystemSetting::query()->updateOrCreate(
                ['key' => $row['key']],
                [
                    'value' => $row['value'],
                    'group' => $row['group'] ?? 'general',
                ],
            );
            $updated[] = $setting;
        }

        $audit->log($request->user(), 'admin.settings.update', null, $oldValues, ['keys' => collect($updated)->pluck('key')], $request);

        return response()->json(['data' => $updated]);
    }
}

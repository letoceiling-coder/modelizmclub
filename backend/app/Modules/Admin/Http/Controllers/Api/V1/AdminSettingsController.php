<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SystemSetting;
use App\Support\FirstHundredPromo;
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
        $settings = SystemSetting::query()->orderBy('group')->orderBy('key')->get()
            ->map(function (SystemSetting $setting): SystemSetting {
                if ($setting->key === FirstHundredPromo::SETTING_KEY) {
                    $setting->value = array_merge(FirstHundredPromo::get(), [
                        'taken' => FirstHundredPromo::takenCount(),
                    ]);
                }

                return $setting;
            });

        return response()->json(['data' => $settings]);
    }

    #[Endpoint(title: 'Обновить настройки')]
    #[BodyParameter('settings', description: 'Массив настроек', example: '[{"key":"site_name","value":{"ru":"ModelizmClub Dev"},"group":"general"}]')]
    public function update(UpdateSettingsRequest $request, AuditService $audit): JsonResponse
    {
        $updated = [];
        $oldValues = [];
        $promoChanged = false;

        foreach ($request->validated('settings') as $row) {
            $value = $row['value'];
            if ($row['key'] === FirstHundredPromo::SETTING_KEY) {
                $value = FirstHundredPromo::normalize($value);
                $promoChanged = true;
            }
            if ($row['key'] === \App\Support\ReferralProgramConfig::SETTING_KEY) {
                $value = \App\Support\ReferralProgramConfig::normalize($value);
            }

            // Previous value is kept in the audit log so publications like
            // icon_overrides can be rolled back from /admin (see §26).
            $oldValues[$row['key']] = SystemSetting::query()->where('key', $row['key'])->first()?->value;

            $setting = SystemSetting::query()->updateOrCreate(
                ['key' => $row['key']],
                [
                    'value' => $value,
                    'group' => $row['group'] ?? 'general',
                ],
            );
            $updated[] = $setting;
        }

        $audit->log($request->user(), 'admin.settings.update', null, $oldValues, ['keys' => collect($updated)->pluck('key')], $request);

        if ($promoChanged) {
            app(\Modules\Billing\Services\FirstHundredService::class)->reconcileAll();
        }

        $payload = collect($updated)->map(function (SystemSetting $setting): SystemSetting {
            if ($setting->key === FirstHundredPromo::SETTING_KEY) {
                $setting->value = array_merge(FirstHundredPromo::get(), [
                    'taken' => FirstHundredPromo::takenCount(),
                ]);
            }

            return $setting;
        });

        return response()->json(['data' => $payload]);
    }
}

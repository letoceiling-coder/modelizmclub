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
use Modules\Billing\Services\SafeDealSettlementService;
use Modules\Billing\Support\SafeDealEscrowConfig;

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

        return response()->json(['data' => $this->withEscrowProvider($settings)]);
    }

    /**
     * Провайдер безопасной сделки: сохранённый выбор и фактический.
     *
     * Они расходятся, когда выбран банк, а эквайринг не настроен — тогда
     * SafeDealSettlementService уводит сделки на кошелёк. Админка должна
     * показывать, куда деньги идут на самом деле, а не только что записано.
     * Строку отдаём всегда, даже если её ещё нет в базе: иначе интерфейсу
     * пришлось бы додумывать текущее состояние по умолчанию.
     *
     * @param  \Illuminate\Support\Collection<int, SystemSetting>  $settings
     * @return \Illuminate\Support\Collection<int, SystemSetting>
     */
    private function withEscrowProvider(\Illuminate\Support\Collection $settings): \Illuminate\Support\Collection
    {
        $effective = app(SafeDealSettlementService::class)->provider();
        $row = $settings->firstWhere('key', SafeDealEscrowConfig::SETTING_KEY);

        if ($row === null) {
            $row = new SystemSetting([
                'key' => SafeDealEscrowConfig::SETTING_KEY,
                'group' => SafeDealEscrowConfig::GROUP,
                'value' => ['provider' => null],
            ]);
            $settings = $settings->push($row);
        }

        $row->value = array_merge(
            is_array($row->value) ? $row->value : [],
            ['effective' => $effective],
        );

        return $settings;
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
            // Настройка распоряжается деньгами покупателя: неизвестное значение
            // отклоняется, а не приводится к умолчанию (см. normalize()).
            if ($row['key'] === SafeDealEscrowConfig::SETTING_KEY) {
                $value = SafeDealEscrowConfig::normalize($value);
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

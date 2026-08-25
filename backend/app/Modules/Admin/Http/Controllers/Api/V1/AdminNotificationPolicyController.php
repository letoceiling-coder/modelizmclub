<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Support\NotificationPolicyRegistry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Modules\Admin\Services\AuditService;
use Modules\Admin\Services\NotificationPolicySettingsService;

class AdminNotificationPolicyController extends Controller
{
    public function show(NotificationPolicySettingsService $service): JsonResponse
    {
        return response()->json(['data' => $service->adminPayload()]);
    }

    public function update(Request $request, NotificationPolicySettingsService $service, AuditService $audit): JsonResponse
    {
        $incomingTypes = $request->input('types');

        $request->validate([
            'types' => ['sometimes', 'array'],
        ]);

        $types = [];
        if (is_array($incomingTypes)) {
            $types = $this->validatedTypePatches($incomingTypes);
        }

        $before = $service->mergedConfig();
        $after = $service->update(['types' => $types]);
        $audit->log($request->user(), 'admin.notifications.policy.update', null, $before, $after, $request);

        return response()->json(['data' => $service->adminPayload()]);
    }

    /**
     * @param  array<string, mixed>  $incoming
     * @return array<string, array<string, mixed>>
     */
    private function validatedTypePatches(array $incoming): array
    {
        $types = [];

        foreach (NotificationPolicyRegistry::types() as $row) {
            $key = $row['key'];
            $patch = is_array($incoming[$key] ?? null) ? $incoming[$key] : [];

            if (array_key_exists('min_tier', $patch) && ! in_array($patch['min_tier'], NotificationPolicyRegistry::TIERS, true)) {
                throw ValidationException::withMessages([
                    "types.{$key}.min_tier" => 'Некорректный уровень.',
                ]);
            }

            if (array_key_exists('channels', $patch)) {
                if (! is_array($patch['channels'])) {
                    throw ValidationException::withMessages([
                        "types.{$key}.channels" => 'Некорректные каналы.',
                    ]);
                }
                foreach ($patch['channels'] as $channel) {
                    if (! in_array($channel, NotificationPolicyRegistry::CHANNELS, true)) {
                        throw ValidationException::withMessages([
                            "types.{$key}.channels" => 'Некорректные каналы.',
                        ]);
                    }
                }
            }

            foreach (['enabled', 'user_can_toggle', 'default_enabled'] as $flag) {
                if (array_key_exists($flag, $patch)) {
                    $patch[$flag] = (bool) $patch[$flag];
                }
            }

            $types[$key] = $patch;
        }

        return $types;
    }
}

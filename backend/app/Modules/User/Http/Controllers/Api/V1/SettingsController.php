<?php

namespace Modules\User\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\NotificationPolicy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Modules\Auth\Services\MaxNotificationService;
use Modules\User\Http\Requests\UpdateSettingsRequest;
use Modules\User\Http\Resources\NotificationPreferenceResource;
use Modules\User\Services\UserService;

class SettingsController extends Controller
{
    public function show(Request $request, UserService $users, NotificationPolicy $policy): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'data' => $this->payload($user, $users, $policy),
        ]);
    }

    public function update(Request $request, UserService $users, NotificationPolicy $policy): JsonResponse
    {
        $validated = $request->validate((new UpdateSettingsRequest)->rules());
        $incoming = $validated['preferences'];
        $allowed = [];

        foreach ($incoming as $index => $pref) {
            $channel = (string) $pref['channel'];
            $type = (string) $pref['type'];
            if (! $policy->isToggleable($channel, $type)) {
                throw ValidationException::withMessages([
                    "preferences.{$index}.type" => 'Этим уведомлением нельзя управлять.',
                ]);
            }
            $allowed[] = $pref;
        }

        $users->updateSettings($request->user(), $allowed);

        return response()->json([
            'data' => $this->payload($request->user(), $users, $policy),
        ]);
    }

    /** @return array<string, mixed> */
    private function payload(mixed $user, UserService $users, NotificationPolicy $policy): array
    {
        $preferences = $users->getSettings($user);
        $maxRow = $preferences->first(
            fn ($row): bool => $row->channel === MaxNotificationService::CHANNEL
                && $row->type === MaxNotificationService::MASTER_TYPE,
        );

        return [
            'preferences' => NotificationPreferenceResource::collection($preferences)->resolve(),
            'items' => $policy->cabinetItems($user),
            'group_labels' => \App\Support\NotificationPolicyRegistry::groupLabels(),
            'user_tier' => $policy->userTier($user),
            'max_enabled' => $maxRow === null || $maxRow->enabled,
        ];
    }
}

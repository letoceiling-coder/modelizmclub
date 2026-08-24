<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Support\FeedGuestAccessRegistry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Modules\Admin\Services\AuditService;
use Modules\PublicContent\Services\FeedGuestAccessService;

class AdminFeedGuestAccessController extends Controller
{
    public function show(FeedGuestAccessService $service): JsonResponse
    {
        return response()->json(['data' => $service->adminPayload()]);
    }

    public function update(Request $request, FeedGuestAccessService $service, AuditService $audit): JsonResponse
    {
        // Read actions before validate(): Laravel Arr::set/undot treats
        // keys like "route.reviews" as nested paths and would drop min_tier.
        $incomingActions = $request->input('actions');

        $data = $request->validate([
            'default_deny_mode' => ['sometimes', 'in:popup,redirect'],
            'popup' => ['sometimes', 'array'],
            'popup.title' => ['sometimes', 'string', 'max:120'],
            'popup.description' => ['sometimes', 'string', 'max:500'],
            'popup.primary_cta' => ['sometimes', 'string', 'max:60'],
            'popup.secondary_cta' => ['sometimes', 'string', 'max:60'],
            'actions' => ['sometimes', 'array'],
        ]);

        if (is_array($incomingActions)) {
            $data['actions'] = $this->validatedActionPatches($incomingActions);
        }

        $before = $service->publicPayload();
        $after = $service->update($data);
        $audit->log($request->user(), 'admin.feed_guest_access.update', null, $before, $after, $request);

        return response()->json(['data' => $service->adminPayload()]);
    }

    /**
     * @param  array<string, mixed>  $incoming
     * @return array<string, array<string, mixed>>
     */
    private function validatedActionPatches(array $incoming): array
    {
        $actions = [];

        foreach (FeedGuestAccessRegistry::actions() as $row) {
            $key = $row['key'];
            $patch = is_array($incoming[$key] ?? null) ? $incoming[$key] : [];

            if (array_key_exists('min_tier', $patch) && ! in_array($patch['min_tier'], FeedGuestAccessRegistry::TIERS, true)) {
                throw ValidationException::withMessages([
                    "actions.{$key}.min_tier" => 'Некорректный уровень доступа.',
                ]);
            }

            if (array_key_exists('deny_mode', $patch) && ! in_array($patch['deny_mode'], ['inherit', 'popup', 'redirect'], true)) {
                throw ValidationException::withMessages([
                    "actions.{$key}.deny_mode" => 'Некорректный режим отказа.',
                ]);
            }

            if (array_key_exists('allowed', $patch)) {
                $patch['allowed'] = (bool) $patch['allowed'];
            }

            $actions[$key] = $patch;
        }

        return $actions;
    }
}

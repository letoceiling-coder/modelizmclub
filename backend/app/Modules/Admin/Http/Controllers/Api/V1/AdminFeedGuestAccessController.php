<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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
        $data = $request->validate([
            'default_deny_mode' => ['sometimes', 'in:popup,redirect'],
            'popup' => ['sometimes', 'array'],
            'popup.title' => ['sometimes', 'string', 'max:120'],
            'popup.description' => ['sometimes', 'string', 'max:500'],
            'popup.primary_cta' => ['sometimes', 'string', 'max:60'],
            'popup.secondary_cta' => ['sometimes', 'string', 'max:60'],
            'actions' => ['sometimes', 'array'],
            'actions.*.allowed' => ['sometimes', 'boolean'],
            'actions.*.min_tier' => ['sometimes', 'in:guest,auth,subscription'],
            'actions.*.deny_mode' => ['sometimes', 'in:inherit,popup,redirect'],
        ]);

        $before = $service->publicPayload();
        $after = $service->update($data);
        $audit->log($request->user(), 'admin.feed_guest_access.update', null, $before, $after, $request);

        return response()->json(['data' => $service->adminPayload()]);
    }
}

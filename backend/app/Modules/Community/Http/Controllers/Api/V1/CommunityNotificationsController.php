<?php

namespace Modules\Community\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Community\Services\CommunityEngagementService;
use Modules\Community\Services\CommunityService;

class CommunityNotificationsController extends Controller
{
    public function __invoke(
        string $slug,
        Request $request,
        CommunityService $communities,
        CommunityEngagementService $engagement,
    ): JsonResponse {
        $community = $communities->findActiveBySlug($slug);
        $this->authorize('notifications', $community);

        $data = $request->validate([
            'enabled' => ['required', 'boolean'],
        ]);

        $enabled = $engagement->setNotifications($request->user(), $community, (bool) $data['enabled']);

        return response()->json([
            'data' => ['notifications_enabled' => $enabled],
            'message' => $enabled ? 'Уведомления включены.' : 'Уведомления отключены.',
        ]);
    }
}

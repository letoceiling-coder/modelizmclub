<?php

namespace Modules\User\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class PresenceHeartbeatController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();
        $cacheKey = 'presence:heartbeat:'.$user->id;

        if (! Cache::has($cacheKey)) {
            $user->forceFill(['last_seen_at' => now()])->save();
            Cache::put($cacheKey, 1, now()->addSeconds(45));
        }

        $user->refresh();

        return response()->json([
            'data' => [
                'last_seen_at' => $user->last_seen_at?->toIso8601String(),
            ],
        ]);
    }
}

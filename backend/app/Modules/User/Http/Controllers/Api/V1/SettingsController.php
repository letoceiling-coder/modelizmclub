<?php

namespace Modules\User\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\User\Http\Requests\UpdateSettingsRequest;
use Modules\User\Http\Resources\NotificationPreferenceResource;
use Modules\User\Services\UserService;

class SettingsController extends Controller
{
    public function show(Request $request, UserService $users): JsonResponse
    {
        return response()->json([
            'data' => NotificationPreferenceResource::collection(
                $users->getSettings($request->user()),
            ),
        ]);
    }

    public function update(UpdateSettingsRequest $request, UserService $users): JsonResponse
    {
        $preferences = $users->updateSettings(
            $request->user(),
            $request->validated('preferences'),
        );

        return response()->json([
            'data' => NotificationPreferenceResource::collection($preferences),
        ]);
    }
}

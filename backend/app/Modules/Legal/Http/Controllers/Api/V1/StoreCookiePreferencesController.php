<?php

namespace Modules\Legal\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\CookiePreference;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StoreCookiePreferencesController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'anonymous_key' => ['nullable', 'string', 'max:64'],
            'analytics' => ['required', 'boolean'],
            'ads' => ['required', 'boolean'],
        ]);

        $user = $request->user();
        $anonymousKey = $validated['anonymous_key'] ?? null;

        $pref = null;
        if ($user) {
            $pref = CookiePreference::query()->firstOrNew(['user_id' => $user->id]);
        } elseif ($anonymousKey) {
            $pref = CookiePreference::query()->firstOrNew(['anonymous_key' => $anonymousKey]);
        } else {
            return response()->json([
                'message' => 'Укажите anonymous_key или авторизуйтесь.',
            ], 422);
        }

        $pref->fill([
            'user_id' => $user?->id,
            'anonymous_key' => $user ? null : $anonymousKey,
            'necessary' => true,
            'analytics' => (bool) $validated['analytics'],
            'ads' => (bool) $validated['ads'],
            'updated_at' => now(),
        ])->save();

        return response()->json([
            'data' => [
                'necessary' => true,
                'analytics' => $pref->analytics,
                'ads' => $pref->ads,
                'updated_at' => $pref->updated_at?->toIso8601String(),
            ],
        ]);
    }
}

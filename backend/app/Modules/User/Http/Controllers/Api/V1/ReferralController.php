<?php

namespace Modules\User\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

#[Group('Referrals', weight: 31)]
class ReferralController extends Controller
{
    private const PER_INVITE = 1;

    private const MAX_BONUS = 10;

    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();
        $code = $user->ensureReferralCode();

        $invited = $user->referrals()
            ->with('profile.avatar')
            ->latest()
            ->limit(100)
            ->get();

        $count = $invited->count();
        $bonus = min($count * self::PER_INVITE, self::MAX_BONUS);

        return response()->json([
            'data' => [
                'code' => $code,
                'invited' => $invited->map(fn ($u) => [
                    'user' => [
                        'uuid' => $u->uuid,
                        'display_name' => $u->profile?->display_name ?? $u->name,
                        'slug' => $u->profile?->slug,
                        'avatar' => $u->profile?->avatar?->url,
                    ],
                    'joined_at' => $u->created_at?->toIso8601String(),
                ])->all(),
                'invited_count' => $count,
                'bonus' => $bonus,
                'max_bonus' => self::MAX_BONUS,
                'per_invite' => self::PER_INVITE,
            ],
        ]);
    }
}

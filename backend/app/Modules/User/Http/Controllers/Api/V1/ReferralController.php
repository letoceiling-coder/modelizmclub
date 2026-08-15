<?php

namespace Modules\User\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Support\ReferralProgramConfig;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Billing\Services\ReferralService;

#[Group('Referrals', weight: 31)]
class ReferralController extends Controller
{
    public function __invoke(Request $request, ReferralService $referrals): JsonResponse
    {
        $user = $request->user();
        $code = $user->ensureReferralCode();
        $config = ReferralProgramConfig::get();

        $invited = $user->referrals()
            ->with('profile.avatar')
            ->latest()
            ->limit(100)
            ->get();

        $count = $invited->count();
        $bonusEarned = min($referrals->referralCreditsEarned($user->id), $config['max_bonus']);

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
                'bonus' => $bonusEarned,
                'listing_credits' => (int) $user->listing_placement_credits,
                'max_bonus' => $config['max_bonus'],
                'per_invite' => $config['per_invite'],
                'enabled' => $config['enabled'],
            ],
        ]);
    }
}

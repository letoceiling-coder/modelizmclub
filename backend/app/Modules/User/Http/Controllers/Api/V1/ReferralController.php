<?php

namespace Modules\User\Http\Controllers\Api\V1;

use App\Enums\ReferralStatus;
use App\Http\Controllers\Controller;
use App\Models\Referral;
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
        $dashboard = $referrals->dashboard($user);

        $invited = $user->referralInvites()
            ->with(['invitee.profile.avatar'])
            ->latest('id')
            ->limit(100)
            ->get();

        $bonusEarned = min($referrals->referralCreditsEarned($user->id), $config['max_bonus']);

        return response()->json([
            'data' => [
                'code' => $code,
                'invited' => $invited->map(fn (Referral $row) => [
                    'user' => [
                        'uuid' => $row->invitee?->uuid,
                        'display_name' => $this->maskName(
                            $row->invitee?->profile?->display_name ?? $row->invitee?->name
                        ),
                        'slug' => null,
                        'avatar' => $row->invitee?->profile?->avatar?->url,
                    ],
                    'joined_at' => $row->created_at?->toIso8601String(),
                    'status' => $row->status instanceof ReferralStatus
                        ? $row->status->value
                        : (string) $row->status,
                    'listing_credits' => (int) $row->listing_credits,
                    'subscription_days' => (int) $row->subscription_days,
                ])->all(),
                'invited_count' => $dashboard['registered'],
                'clicks' => $dashboard['clicks'],
                'verified' => $dashboard['verified'],
                'bonus' => $bonusEarned,
                'listing_credits' => (int) $user->listing_placement_credits,
                'max_bonus' => $config['max_bonus'],
                'per_invite' => $config['per_invite'],
                'reward_listing_credits' => $config['reward_listing_credits'],
                'reward_subscription_days' => $config['reward_subscription_days'],
                'enabled' => $config['enabled'],
            ],
        ]);
    }

    private function maskName(?string $name): string
    {
        $name = trim((string) $name);
        if ($name === '') {
            return 'Друг';
        }

        return mb_substr($name, 0, 1).'***';
    }
}

<?php

namespace Modules\User\Http\Controllers\Api\V1;

use App\Enums\ReferralStatus;
use App\Http\Controllers\Controller;
use App\Models\Referral;
use App\Support\ReferralProgramConfig;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Billing\Services\BonusPointsService;
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

        /*
         * Статистика «Бонусов» — фактически начисленное, без подрезки
         * пределом. Прежде здесь стоял `min(..., max_bonus)`, и человек,
         * которому начислили больше предела, видел не то, что у него есть.
         * Предел теперь и так соблюдается при начислении.
         */
        $заработано = $referrals->referralPointsEarned($user->id);

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
                    // Что принесло это приглашение. Старые строки помнят
                    // штуки размещений — их не переписываем в баллы.
                    'points' => (int) $row->points,
                    'listing_credits' => (int) $row->listing_credits,
                ])->all(),
                'invited_count' => $dashboard['registered'],
                'clicks' => $dashboard['clicks'],
                'verified' => $dashboard['verified'],
                // Заработано приглашениями — и весь баланс баллов целиком:
                // баллы бывают начислены и другим путём, из админки.
                'bonus' => $заработано,
                'points_balance' => app(BonusPointsService::class)->balance($user),
                // Настройки акции: страница пишет награду из них, а не из
                // зашитого текста. Поменяли число в админке — текст сменился.
                'points_per_invite' => $config['points_per_invite'],
                'max_paid_invites' => $config['max_paid_invites'],
                'terms' => $config['terms'],
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

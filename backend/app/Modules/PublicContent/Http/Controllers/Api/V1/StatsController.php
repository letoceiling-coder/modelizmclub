<?php

namespace Modules\PublicContent\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Support\FirstHundredPromo;
use App\Support\ReferralProgramConfig;
use Illuminate\Http\JsonResponse;

class StatsController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $stats = FirstHundredPromo::publicStats();
        $referral = ReferralProgramConfig::get();

        return response()->json([
            'data' => [
                'first_hundred' => [
                    'taken' => $stats['taken'],
                    'total' => $stats['total'],
                    'enabled' => $stats['enabled'],
                ],
                'referral' => [
                    'enabled' => $referral['enabled'],
                    'per_invite' => $referral['per_invite'],
                    'max_bonus' => $referral['max_bonus'],
                ],
            ],
        ]);
    }
}

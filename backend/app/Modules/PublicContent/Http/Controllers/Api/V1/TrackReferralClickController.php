<?php

namespace Modules\PublicContent\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Billing\Services\ReferralService;

class TrackReferralClickController extends Controller
{
    public function __invoke(Request $request, ReferralService $referrals): JsonResponse
    {
        $code = (string) $request->input('code', '');
        if (strlen($code) >= 4 && strlen($code) <= 40) {
            $referrals->recordClick($code);
        }

        return response()->json(['status' => 'ok'])
            ->cookie('mdlzm_ref', strtoupper(trim($code)), 60 * 24 * 30, '/', null, $request->secure(), false, false, 'lax');
    }
}

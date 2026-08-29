<?php

namespace Modules\User\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Modules\Billing\Services\ReferralService;

class ClaimReferralController extends Controller
{
    public function __invoke(Request $request, ReferralService $referrals): JsonResponse
    {
        $code = trim((string) $request->input('code', ''));
        if ($code === '') {
            throw ValidationException::withMessages(['code' => ['Укажите реферальный код.']]);
        }

        $ok = $referrals->claimCode($request->user(), $code);

        return response()->json(['data' => ['claimed' => $ok]]);
    }
}

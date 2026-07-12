<?php

namespace Modules\Account\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Account\Services\EmailAccountService;

class ResendVerificationEmailController extends Controller
{
    public function __invoke(Request $request, EmailAccountService $emails): JsonResponse
    {
        $emails->resendVerification($request->user());

        return response()->json(null, 202);
    }
}

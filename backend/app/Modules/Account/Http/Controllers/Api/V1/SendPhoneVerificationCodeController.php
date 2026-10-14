<?php

namespace Modules\Account\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Modules\Account\Http\Requests\SendPhoneVerificationRequest;
use Modules\Auth\Services\PhoneVerificationService;

class SendPhoneVerificationCodeController extends Controller
{
    public function __invoke(
        SendPhoneVerificationRequest $request,
        PhoneVerificationService $phones,
    ): JsonResponse {
        $result = $phones->sendCode(
            $request->user(),
            $request->string('phone')->toString(),
            $request,
        );

        return response()->json(['data' => $result->toResponseData()], 202);
    }
}

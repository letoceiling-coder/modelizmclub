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
        $phones->sendCode(
            $request->user(),
            $request->string('phone')->toString(),
            $request,
        );

        $ttl = (int) config('sms.verification.ttl_minutes', 10);

        return response()->json([
            'data' => [
                'message' => 'Код отправлен по SMS.',
                'expires_in_minutes' => $ttl,
            ],
        ], 202);
    }
}

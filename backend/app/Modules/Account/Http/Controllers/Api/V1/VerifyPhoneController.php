<?php

namespace Modules\Account\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Modules\Account\Http\Requests\VerifyPhoneRequest;
use Modules\Auth\Http\Resources\UserResource;
use Modules\Auth\Services\PhoneVerificationService;

class VerifyPhoneController extends Controller
{
    public function __invoke(
        VerifyPhoneRequest $request,
        PhoneVerificationService $phones,
    ): JsonResponse {
        $user = $phones->verifyCode(
            $request->user(),
            $request->string('phone')->toString(),
            $request->string('code')->toString(),
        );

        return response()->json([
            'data' => new UserResource($user),
        ]);
    }
}

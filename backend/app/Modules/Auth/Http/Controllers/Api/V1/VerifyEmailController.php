<?php

namespace Modules\Auth\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Modules\Auth\Http\Requests\VerifyEmailRequest;
use Modules\Auth\Http\Resources\UserResource;
use Modules\Auth\Services\AuthService;

class VerifyEmailController extends Controller
{
    public function __invoke(VerifyEmailRequest $request, AuthService $auth): JsonResponse
    {
        $result = $auth->verifyEmail(
            email: $request->string('email')->toString(),
            code: $request->string('code')->toString(),
        );

        return response()->json([
            'data' => new UserResource($result['user']),
            'meta' => [
                'token' => $result['token'],
                'token_type' => 'Bearer',
            ],
        ]);
    }
}

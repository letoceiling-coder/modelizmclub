<?php

namespace Modules\Auth\Http\Controllers\Api\V1;

use App\Enums\RegistrationTrack;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Modules\Auth\Http\Requests\RegisterRequest;
use Modules\Auth\Services\AuthService;

class RegisterController extends Controller
{
    public function __invoke(RegisterRequest $request, AuthService $auth): JsonResponse
    {
        $auth->register(
            email: $request->string('email')->toString(),
            password: $request->string('password')->toString(),
            track: RegistrationTrack::from($request->string('registration_track')->toString()),
            displayName: $request->filled('display_name') ? $request->string('display_name')->toString() : null,
        );

        return response()->json([
            'data' => [
                'message' => 'Код подтверждения отправлен на email.',
            ],
        ], 201);
    }
}

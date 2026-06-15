<?php

namespace Modules\Auth\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Auth\Services\AuthService;

class LogoutController extends Controller
{
    public function __invoke(Request $request, AuthService $auth): JsonResponse
    {
        $auth->logout($request->user());

        return response()->json([
            'data' => [
                'message' => 'Вы вышли из системы.',
            ],
        ]);
    }
}

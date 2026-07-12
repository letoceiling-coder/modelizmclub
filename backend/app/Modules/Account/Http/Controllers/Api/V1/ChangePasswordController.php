<?php

namespace Modules\Account\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Account\Services\AccountSecurityService;

class ChangePasswordController extends Controller
{
    public function __invoke(Request $request, AccountSecurityService $security): JsonResponse
    {
        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'new_password' => ['required', 'string', 'min:8'],
        ], [], [
            'new_password' => 'новый пароль',
        ]);

        $security->changePassword(
            $request->user(),
            $data['current_password'],
            $data['new_password'],
        );

        return response()->json(['ok' => true]);
    }
}

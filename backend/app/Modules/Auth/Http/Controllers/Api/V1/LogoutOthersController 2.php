<?php

namespace Modules\Auth\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Account\Services\AccountSecurityService;

class LogoutOthersController extends Controller
{
    public function __invoke(Request $request, AccountSecurityService $security): JsonResponse
    {
        $security->logoutOtherDevices($request->user());

        return response()->json(['message' => 'ok']);
    }
}

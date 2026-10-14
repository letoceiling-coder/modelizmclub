<?php

namespace Modules\Account\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Auth\Services\PhoneVerificationService;

class ShowPhoneVerificationSessionController extends Controller
{
    public function __invoke(Request $request, string $sessionId, PhoneVerificationService $phones): JsonResponse
    {
        $view = $phones->sessionView($request->user(), $sessionId);

        return response()->json(['data' => $view->toResponseData()]);
    }
}

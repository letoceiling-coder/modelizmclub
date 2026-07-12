<?php

namespace Modules\Account\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Account\Services\TwoFactorService;

class SetupTwoFactorController extends Controller
{
    public function __invoke(Request $request, TwoFactorService $twoFactor): JsonResponse
    {
        return response()->json([
            'data' => $twoFactor->setup($request->user()),
        ]);
    }
}

<?php

namespace Modules\Account\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Account\Services\TwoFactorService;

class DisableTwoFactorController extends Controller
{
    public function __invoke(Request $request, TwoFactorService $twoFactor): JsonResponse
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'size:6'],
        ]);

        $twoFactor->disable($request->user(), $data['code']);

        return response()->json(['ok' => true]);
    }
}

<?php

namespace Modules\Billing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Billing\Services\WalletService;

class WalletBalanceController extends Controller
{
    public function __invoke(Request $request, WalletService $wallet): JsonResponse
    {
        return response()->json($wallet->balance($request->user()));
    }
}

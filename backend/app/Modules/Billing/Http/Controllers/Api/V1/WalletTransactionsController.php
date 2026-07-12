<?php

namespace Modules\Billing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Billing\Services\WalletService;

class WalletTransactionsController extends Controller
{
    public function __invoke(Request $request, WalletService $wallet): JsonResponse
    {
        $perPage = min(100, max(1, (int) $request->query('per_page', 20)));

        return response()->json($wallet->transactions($request->user(), $perPage));
    }
}

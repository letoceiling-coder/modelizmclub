<?php

namespace Modules\Account\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Account\Services\ViewHistoryService;

class ClearViewHistoryController extends Controller
{
    public function __invoke(Request $request, ViewHistoryService $history): JsonResponse
    {
        $history->clear($request->user());

        return response()->json(['ok' => true]);
    }
}

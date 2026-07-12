<?php

namespace Modules\Account\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Account\Services\PayoutRequisitesService;

class ShowPayoutRequisitesController extends Controller
{
    public function __invoke(Request $request, PayoutRequisitesService $requisites): JsonResponse
    {
        return response()->json([
            'data' => $requisites->show($request->user()),
        ]);
    }
}

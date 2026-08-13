<?php

namespace Modules\Legal\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Legal\Services\ConsentService;

class IndexMyConsentsController extends Controller
{
    public function __invoke(Request $request, ConsentService $consents): JsonResponse
    {
        return response()->json([
            'data' => $consents->listForUser($request->user()),
        ]);
    }
}

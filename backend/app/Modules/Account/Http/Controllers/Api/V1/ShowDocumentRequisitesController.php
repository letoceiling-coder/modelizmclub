<?php

namespace Modules\Account\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Account\Services\DocumentRequisitesService;

class ShowDocumentRequisitesController extends Controller
{
    public function __invoke(Request $request, DocumentRequisitesService $service): JsonResponse
    {
        return response()->json(['data' => $service->show($request->user())]);
    }
}

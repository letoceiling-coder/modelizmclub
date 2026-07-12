<?php

namespace Modules\Account\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Account\Services\DocumentRequisitesService;

class UpdateDocumentRequisitesController extends Controller
{
    public function __invoke(Request $request, DocumentRequisitesService $service): JsonResponse
    {
        $data = $request->validate([
            'full_name' => ['nullable', 'string', 'max:255'],
            'inn' => ['nullable', 'string', 'max:32'],
            'phone' => ['nullable', 'string', 'max:32'],
            'address' => ['nullable', 'string', 'max:512'],
        ]);

        return response()->json(['data' => $service->update($request->user(), $data)]);
    }
}

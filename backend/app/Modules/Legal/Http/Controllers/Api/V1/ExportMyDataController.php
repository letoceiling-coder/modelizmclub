<?php

namespace Modules\Legal\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Legal\Services\UserDataExportService;

class ExportMyDataController extends Controller
{
    public function __invoke(Request $request, UserDataExportService $export): JsonResponse
    {
        return response()->json([
            'data' => $export->export($request->user()),
        ]);
    }
}

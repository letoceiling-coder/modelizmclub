<?php

namespace Modules\Catalog\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Catalog\Services\AddressSuggestService;

class SuggestAddressController extends Controller
{
    public function __invoke(Request $request, AddressSuggestService $suggest): JsonResponse
    {
        $query = trim((string) $request->string('q'));
        $city = trim((string) $request->string('city'));

        return response()->json([
            'data' => $suggest->suggest($query, $city !== '' ? $city : null),
        ]);
    }
}

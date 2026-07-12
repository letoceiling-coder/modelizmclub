<?php

namespace Modules\Account\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Account\Services\PayoutRequisitesService;

class UpdatePayoutRequisitesController extends Controller
{
    public function __invoke(Request $request, PayoutRequisitesService $requisites): JsonResponse
    {
        $data = $request->validate([
            'card_number' => ['required', 'string', 'regex:/^\d{16}$/'],
        ]);

        $requisites->update($request->user(), $data['card_number']);

        return response()->json(['message' => 'ok']);
    }
}

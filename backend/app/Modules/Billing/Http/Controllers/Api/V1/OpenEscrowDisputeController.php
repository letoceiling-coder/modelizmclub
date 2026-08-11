<?php

namespace Modules\Billing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\EscrowDeal;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Billing\Services\EscrowService;

#[Group('Escrow', weight: 36)]
class OpenEscrowDisputeController extends Controller
{
    public function __invoke(Request $request, string $uuid, EscrowService $escrow): JsonResponse
    {
        $deal = EscrowDeal::query()->with(['listing', 'shipment'])->where('uuid', $uuid)->firstOrFail();

        $validated = $request->validate([
            'reason' => ['required', 'string', 'min:10', 'max:2000'],
        ]);

        $deal = $escrow->openDispute($request->user(), $deal, $validated['reason']);

        return response()->json([
            'data' => $escrow->toArray($deal, $request->user()),
            'message' => 'Спор открыт. Модератор рассмотрит обращение.',
        ]);
    }
}

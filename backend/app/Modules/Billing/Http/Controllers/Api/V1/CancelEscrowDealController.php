<?php

namespace Modules\Billing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\EscrowDeal;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Billing\Services\EscrowService;

#[Group('Escrow', weight: 36)]
class CancelEscrowDealController extends Controller
{
    public function __invoke(Request $request, string $uuid, EscrowService $escrow): JsonResponse
    {
        $deal = EscrowDeal::query()->with('listing')->where('uuid', $uuid)->firstOrFail();

        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        $deal = $escrow->cancel($request->user(), $deal, $validated['reason'] ?? null);

        return response()->json([
            'data' => $escrow->toArray($deal, $request->user()),
            'message' => 'Сделка отменена.',
        ]);
    }
}

<?php

namespace Modules\Billing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Listing;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Billing\Services\EscrowService;

#[Group('Escrow', weight: 36)]
class CreateEscrowCheckoutController extends Controller
{
    public function __invoke(Request $request, string $uuid, EscrowService $escrow): JsonResponse
    {
        $listing = Listing::query()->where('uuid', $uuid)->firstOrFail();

        $validated = $request->validate([
            'delivery_amount_cents' => ['sometimes', 'integer', 'min:0', 'max:100000000'],
            'shipment_id' => ['sometimes', 'nullable', 'integer', 'exists:shipments,id'],
        ]);

        $result = $escrow->startCheckout(
            $request->user(),
            $listing,
            (int) ($validated['delivery_amount_cents'] ?? 0),
            isset($validated['shipment_id']) ? (int) $validated['shipment_id'] : null,
        );

        $providerLabel = $result['provider'] === 'vtb' ? 'ВТБ' : 'ЮKassa';

        return response()->json([
            'data' => $result,
            'message' => $result['checkout_url']
                ? "Перенаправление на оплату через {$providerLabel} (безопасная сделка)."
                : 'Сделка создана.',
        ], 201);
    }
}

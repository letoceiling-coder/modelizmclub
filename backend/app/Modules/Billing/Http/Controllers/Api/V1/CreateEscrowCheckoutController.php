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

        $result = $escrow->startCheckout($request->user(), $listing);

        return response()->json([
            'data' => $result,
            'message' => $result['checkout_url']
                ? 'Перенаправление на оплату через ЮKassa (безопасная сделка).'
                : 'Сделка создана.',
        ], 201);
    }
}

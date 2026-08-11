<?php

namespace Modules\Billing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Listing;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Billing\Services\EscrowService;

#[Group('Escrow', weight: 36)]
class EscrowQuoteController extends Controller
{
    public function __invoke(Request $request, EscrowService $escrow): JsonResponse
    {
        $validated = $request->validate([
            'listing_uuid' => ['required', 'uuid'],
            'delivery_cents' => ['sometimes', 'integer', 'min:0', 'max:100000000'],
        ]);

        $listing = Listing::query()->where('uuid', $validated['listing_uuid'])->firstOrFail();
        $deliveryCents = (int) ($validated['delivery_cents'] ?? 0);

        return response()->json(['data' => $escrow->quote($listing, $deliveryCents)]);
    }
}

<?php

namespace Modules\Billing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Listing;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Billing\Services\EscrowService;

#[Group('Escrow', weight: 36)]
class ListingEscrowDealController extends Controller
{
    public function __invoke(Request $request, string $uuid, EscrowService $escrow): JsonResponse
    {
        $listing = Listing::query()->where('uuid', $uuid)->firstOrFail();
        $deal = $escrow->findActiveForListing($listing, $request->user());

        return response()->json([
            'data' => $deal ? $escrow->toArray($deal->load(['listing', 'shipment']), $request->user()) : null,
        ]);
    }
}

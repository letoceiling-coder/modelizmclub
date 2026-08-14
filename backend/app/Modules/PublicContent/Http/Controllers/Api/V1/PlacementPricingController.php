<?php

namespace Modules\PublicContent\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Modules\Listing\Support\ListingPlacementConfig;

class PlacementPricingController extends Controller
{
    public function __invoke(): JsonResponse
    {
        return response()->json([
            'data' => [
                'registered_price_cents' => ListingPlacementConfig::registeredPriceCents(),
                'guest_price_cents' => ListingPlacementConfig::guestPriceCents(),
                'subscriber_default_price_cents' => ListingPlacementConfig::subscriberDefaultPriceCents(),
                'payment_enabled' => ListingPlacementConfig::paymentEnabled(),
            ],
        ]);
    }
}

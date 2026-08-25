<?php

namespace Modules\Billing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Listing;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Billing\Services\SafeDealService;

class QuoteSafeDealController extends Controller
{
    public function __invoke(Request $request, string $uuid, SafeDealService $deals): JsonResponse
    {
        $listing = Listing::query()->with(['city', 'author'])->where('uuid', $uuid)->firstOrFail();

        $data = $request->validate([
            'destination_point' => ['nullable', 'array'],
            'destination_point.city_code' => ['required_with:destination_point', 'integer', 'min:1'],
            'destination_point.external_point_id' => ['nullable', 'string', 'max:64'],
            'destination_point.name' => ['nullable', 'string', 'max:255'],
            'destination_point.address' => ['nullable', 'string', 'max:500'],
            'destination_point.latitude' => ['nullable', 'numeric'],
            'destination_point.longitude' => ['nullable', 'numeric'],
        ]);

        return response()->json([
            'data' => $deals->quoteForListing($listing, $data['destination_point'] ?? []),
        ]);
    }
}

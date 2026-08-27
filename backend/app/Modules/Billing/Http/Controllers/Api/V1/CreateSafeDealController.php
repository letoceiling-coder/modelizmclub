<?php

namespace Modules\Billing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Listing;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Billing\Services\SafeDealService;

class CreateSafeDealController extends Controller
{
    public function __invoke(Request $request, string $uuid, SafeDealService $deals): JsonResponse
    {
        $listing = Listing::query()->with(['city', 'author'])->where('uuid', $uuid)->firstOrFail();

        $data = $request->validate([
            'accept_terms' => ['required', 'accepted'],
            'destination_point' => ['nullable', 'array'],
            'destination_point.city_code' => ['required_with:destination_point', 'integer', 'min:1'],
            'destination_point.external_point_id' => ['nullable', 'string', 'max:64'],
            'destination_point.name' => ['nullable', 'string', 'max:255'],
            'destination_point.address' => ['nullable', 'string', 'max:500'],
            'destination_point.latitude' => ['nullable', 'numeric'],
            'destination_point.longitude' => ['nullable', 'numeric'],
        ]);

        $deal = $deals->create($request->user(), $listing, $data);

        return response()->json([
            'data' => $deals->toArray($deal, $request->user()),
            'message' => 'Безопасная сделка создана, средства заблокированы на балансе.',
        ], 201);
    }
}

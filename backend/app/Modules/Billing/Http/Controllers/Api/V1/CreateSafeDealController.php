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
        $listing = Listing::query()->where('uuid', $uuid)->firstOrFail();

        $deal = $deals->create($request->user(), $listing);

        return response()->json([
            'data' => $deals->toArray($deal),
            'message' => 'Безопасная сделка создана, средства заблокированы на балансе.',
        ], 201);
    }
}

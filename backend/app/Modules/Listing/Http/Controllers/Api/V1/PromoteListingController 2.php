<?php

namespace Modules\Listing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Listing;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Listing\Services\ListingBoostService;

class PromoteListingController extends Controller
{
    public function __invoke(Request $request, string $uuid, ListingBoostService $boost): JsonResponse
    {
        $data = $request->validate([
            'package' => ['required', 'string'],
            'idempotency_key' => ['nullable', 'string', 'max:128'],
        ]);

        $listing = Listing::query()->where('uuid', $uuid)->firstOrFail();

        $result = $boost->createPromoteCheckout(
            $request->user(),
            $listing,
            $data['package'],
            $data['idempotency_key'] ?? null,
        );

        return response()->json([
            'data' => $result,
            'message' => $result['checkout_url']
                ? 'Платёж создан. Перенаправление на оплату.'
                : 'Платёж создан. Подтвердите оплату в тестовом режиме.',
        ], 201);
    }
}

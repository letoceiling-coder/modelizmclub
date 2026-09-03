<?php

namespace Modules\Billing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Listing;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Billing\Services\SafeDealService;
use App\Models\SafeDeal;

class CreateSafeDealController extends Controller
{
    public function __invoke(Request $request, string $uuid, SafeDealService $deals): JsonResponse
    {
        $listing = Listing::query()->with(['city', 'author'])->where('uuid', $uuid)->firstOrFail();
        $this->authorize('create', [SafeDeal::class, $listing]);

        $data = $request->validate([
            'accept_terms' => ['required', 'accepted'],
            'return_url' => ['nullable', 'string', 'max:2000'],
            'destination_point' => ['nullable', 'array'],
            'destination_point.city_code' => ['required_with:destination_point', 'integer', 'min:1'],
            'destination_point.external_point_id' => ['nullable', 'string', 'max:64'],
            'destination_point.name' => ['nullable', 'string', 'max:255'],
            'destination_point.address' => ['nullable', 'string', 'max:500'],
            'destination_point.latitude' => ['nullable', 'numeric'],
            'destination_point.longitude' => ['nullable', 'numeric'],
        ]);

        $deal = $deals->create($request->user(), $listing, $data);
        $payload = $deals->toArray($deal, $request->user());

        return response()->json([
            'data' => $payload,
            'message' => match (true) {
                ! $payload['checkout_url'] => 'Безопасная сделка создана, средства заблокированы на балансе.',
                (bool) $payload['escrow_holds_on_card'] => 'Сделка создана. Подтвердите оплату — банк удержит сумму на вашей карте.',
                default => 'Сделка создана. Оплатите картой — деньги придут продавцу только после подтверждения получения.',
            },
        ], 201);
    }
}

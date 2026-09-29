<?php

namespace Modules\Listing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Listing;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Modules\Billing\Exceptions\InsufficientPointsException;
use Modules\Listing\Services\ListingBoostService;

class PromoteListingController extends Controller
{
    public function __invoke(Request $request, string $uuid, ListingBoostService $boost): JsonResponse
    {
        $data = $request->validate([
            'package' => ['required', 'string'],
            'idempotency_key' => ['nullable', 'string', 'max:128'],
            'pay_with' => ['sometimes', 'nullable', Rule::in(['gateway', 'points'])],
        ]);

        $listing = Listing::query()->where('uuid', $uuid)->firstOrFail();
        $this->authorize('promote', $listing);

        try {
            $result = $boost->createPromoteCheckout(
                $request->user(),
                $listing,
                $data['package'],
                $data['idempotency_key'] ?? null,
                $data['pay_with'] ?? 'gateway',
            );
        } catch (InsufficientPointsException $e) {
            // Число, а не «недостаточно»: иначе человек идёт искать остаток
            // в другом месте, чтобы понять, сколько зарабатывать.
            return response()->json([
                'message' => $e->getMessage(),
                'code' => 'insufficient_points',
                'points_balance' => $e->balance,
                'points_short_by' => $e->shortBy,
                'errors' => ['pay_with' => [$e->getMessage()]],
            ], 422);
        }

        return response()->json([
            'data' => $result,
            'message' => match (true) {
                ($result['provider'] ?? null) === 'points' => 'Оплачено баллами.',
                (bool) $result['checkout_url'] => 'Платёж создан. Перенаправление на оплату.',
                default => 'Платёж создан. Подтвердите оплату в тестовом режиме.',
            },
        ], 201);
    }
}

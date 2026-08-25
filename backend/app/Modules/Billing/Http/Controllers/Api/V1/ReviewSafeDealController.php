<?php

namespace Modules\Billing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SafeDeal;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Billing\Services\SafeDealService;

class ReviewSafeDealController extends Controller
{
    public function __invoke(Request $request, string $uuid, SafeDealService $deals): JsonResponse
    {
        $data = $request->validate([
            'rating' => ['required', 'integer', 'min:1', 'max:5'],
            'text' => ['nullable', 'string', 'max:2000'],
        ]);

        $deal = SafeDeal::query()->with(['listing', 'shipment'])->where('uuid', $uuid)->firstOrFail();
        $review = $deals->review($request->user(), $deal, (int) $data['rating'], $data['text'] ?? null);

        return response()->json([
            'data' => [
                'id' => $review->uuid,
                'rating' => $review->rating,
                'text' => $review->text,
                'deal' => $deals->toArray($deal->fresh(['listing', 'shipment', 'reviews']), $request->user()),
            ],
            'message' => 'Оценка сохранена.',
        ], 201);
    }
}

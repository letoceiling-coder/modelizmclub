<?php

namespace Modules\Billing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SafeDeal;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Billing\Services\SafeDealService;

class SafeDealActionsController extends Controller
{
    public function __construct(private readonly SafeDealService $deals) {}

    public function ship(Request $request, string $uuid): JsonResponse
    {
        $data = $request->validate([
            'tracking_number' => ['nullable', 'string', 'max:120'],
            'delivery_method' => ['nullable', 'string', 'max:50'],
        ]);

        $deal = $this->deal($uuid);
        $deal = $this->deals->ship($request->user(), $deal, $data['tracking_number'] ?? null, $data['delivery_method'] ?? null);

        return $this->respond($deal, 'Сделка отмечена как отправленная.');
    }

    public function delivered(Request $request, string $uuid): JsonResponse
    {
        $deal = $this->deal($uuid);

        if (! $deal->involves($request->user()) && ! $request->user()->isModerator()) {
            abort(403);
        }

        $deal = $this->deals->markDelivered($deal, $request->user());

        return $this->respond($deal, 'Сделка отмечена как доставленная.');
    }

    public function confirm(Request $request, string $uuid): JsonResponse
    {
        $deal = $this->deal($uuid);
        $deal = $this->deals->confirm($request->user(), $deal);

        return $this->respond($deal, 'Получение подтверждено, средства переведены продавцу.');
    }

    public function cancel(Request $request, string $uuid): JsonResponse
    {
        $deal = $this->deal($uuid);
        $deal = $this->deals->cancel($request->user(), $deal);

        return $this->respond($deal, 'Сделка отменена, средства возвращены покупателю.');
    }

    public function dispute(Request $request, string $uuid): JsonResponse
    {
        $data = $request->validate([
            'reason' => ['required', 'string', 'max:100'],
            'description' => ['nullable', 'string', 'max:2000'],
        ]);

        $deal = $this->deal($uuid);
        $dispute = $this->deals->openDispute($request->user(), $deal, $data['reason'], $data['description'] ?? null);

        return response()->json([
            'data' => [
                'uuid' => $dispute->uuid,
                'status' => $dispute->status->value,
                'deal' => $this->deals->toArray($deal->fresh()),
            ],
            'message' => 'Спор открыт. Модератор рассмотрит его в ближайшее время.',
        ], 201);
    }

    private function deal(string $uuid): SafeDeal
    {
        return SafeDeal::query()->with(['listing', 'buyer', 'seller'])->where('uuid', $uuid)->firstOrFail();
    }

    private function respond(SafeDeal $deal, string $message): JsonResponse
    {
        return response()->json([
            'data' => $this->deals->toArray($deal),
            'message' => $message,
        ]);
    }
}

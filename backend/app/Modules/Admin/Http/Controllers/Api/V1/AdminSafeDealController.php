<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SafeDeal;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Billing\Services\SafeDealService;

class AdminSafeDealController extends Controller
{
    public function __construct(private readonly SafeDealService $deals) {}

    public function index(Request $request): JsonResponse
    {
        $query = SafeDeal::query()->with(['listing', 'buyer', 'seller'])->latest();

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        $paginator = $query->paginate(min(100, max(1, (int) $request->query('per_page', 25))));

        return response()->json([
            'data' => collect($paginator->items())->map(function (SafeDeal $deal) {
                $row = $this->deals->toArray($deal);
                $row['buyer'] = ['uuid' => $deal->buyer?->uuid, 'name' => $deal->buyer?->name];
                $row['seller'] = ['uuid' => $deal->seller?->uuid, 'name' => $deal->seller?->name];

                return $row;
            })->all(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    public function release(Request $request, string $uuid): JsonResponse
    {
        $deal = SafeDeal::query()->where('uuid', $uuid)->firstOrFail();
        $deal = $this->deals->confirm($request->user(), $deal);

        return response()->json(['data' => $this->deals->toArray($deal), 'message' => 'Средства переведены продавцу.']);
    }

    public function refund(Request $request, string $uuid): JsonResponse
    {
        $deal = SafeDeal::query()->where('uuid', $uuid)->firstOrFail();
        $deal = $this->deals->cancel($request->user(), $deal);

        return response()->json(['data' => $this->deals->toArray($deal), 'message' => 'Средства возвращены покупателю.']);
    }
}

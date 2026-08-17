<?php

namespace Modules\Billing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SafeDeal;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Billing\Services\SafeDealService;

class IndexSafeDealsController extends Controller
{
    public function __invoke(Request $request, SafeDealService $deals): JsonResponse
    {
        $user = $request->user();
        $role = $request->query('role'); // buyer|seller|null(both)

        $query = SafeDeal::query()->with('listing')->latest();

        if ($role === 'buyer') {
            $query->where('buyer_id', $user->id);
        } elseif ($role === 'seller') {
            $query->where('seller_id', $user->id);
        } else {
            $query->where(function ($q) use ($user): void {
                $q->where('buyer_id', $user->id)->orWhere('seller_id', $user->id);
            });
        }

        $paginator = $query->paginate(min(50, max(1, (int) $request->query('per_page', 20))));

        return response()->json([
            'data' => collect($paginator->items())->map(fn (SafeDeal $deal) => $deals->toArray($deal))->all(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }
}

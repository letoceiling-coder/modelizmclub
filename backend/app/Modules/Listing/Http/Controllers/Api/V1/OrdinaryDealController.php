<?php

namespace Modules\Listing\Http\Controllers\Api\V1;

use App\Enums\OrdinaryDealStatus;
use App\Http\Controllers\Controller;
use App\Models\OrdinaryDeal;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Listing\Services\OrdinaryDealService;

class OrdinaryDealController extends Controller
{
    public function __construct(private readonly OrdinaryDealService $deals) {}

    /**
     * Действующие обычные сделки человека. Снятые отметки сделками не
     * считаются ни здесь, ни во вкладке «Сделки» мессенджера.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $role = $request->query('role');

        $query = OrdinaryDeal::query()
            ->with(['listing.mediaItems.media', 'seller.profile', 'buyer.profile', 'conversation'])
            ->where('status', OrdinaryDealStatus::Active)
            ->latest();

        if ($role === 'buyer') {
            $query->where('buyer_id', $user->id);
        } elseif ($role === 'seller') {
            $query->where('seller_id', $user->id);
        } else {
            $query->where(fn ($q) => $q->where('buyer_id', $user->id)->orWhere('seller_id', $user->id));
        }

        $paginator = $query->paginate(min(50, max(1, (int) $request->query('per_page', 20))));

        return response()->json([
            'data' => collect($paginator->items())->map(fn (OrdinaryDeal $d) => $this->deals->toArray($d, $user))->all(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    public function store(Request $request, string $uuid): JsonResponse
    {
        $data = $request->validate(['listing_uuid' => ['nullable', 'uuid']]);
        $deal = $this->deals->markSold($request->user(), $uuid, $data['listing_uuid'] ?? null);

        return response()->json(['data' => $this->deals->toArray($deal, $request->user())], 201);
    }

    public function decline(Request $request, string $uuid): JsonResponse
    {
        $deal = $this->deals->decline($request->user(), $uuid);

        return response()->json(['data' => $this->deals->toArray($deal->load(['listing.mediaItems.media', 'seller.profile', 'buyer.profile', 'conversation']), $request->user())]);
    }

    public function cancel(Request $request, string $uuid): JsonResponse
    {
        $deal = $this->deals->cancel($request->user(), $uuid);

        return response()->json(['data' => $this->deals->toArray($deal->load(['listing.mediaItems.media', 'seller.profile', 'buyer.profile', 'conversation']), $request->user())]);
    }
}

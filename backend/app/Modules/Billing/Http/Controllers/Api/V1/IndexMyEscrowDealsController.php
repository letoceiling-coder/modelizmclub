<?php

namespace Modules\Billing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\EscrowDeal;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Billing\Services\EscrowService;

#[Group('Escrow', weight: 36)]
class IndexMyEscrowDealsController extends Controller
{
    public function __invoke(Request $request, EscrowService $escrow): JsonResponse
    {
        $user = $request->user();
        $role = $request->query('role');

        $query = EscrowDeal::query()
            ->with(['listing', 'shipment'])
            ->where(function ($q) use ($user): void {
                $q->where('buyer_id', $user->id)->orWhere('seller_id', $user->id);
            })
            ->latest('id');

        if ($role === 'buyer') {
            $query->where('buyer_id', $user->id);
        } elseif ($role === 'seller') {
            $query->where('seller_id', $user->id);
        }

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        $deals = $query->limit(min((int) $request->query('per_page', 20), 50))->get();

        return response()->json([
            'data' => $deals->map(fn (EscrowDeal $d) => $escrow->toArray($d, $user))->values(),
        ]);
    }
}

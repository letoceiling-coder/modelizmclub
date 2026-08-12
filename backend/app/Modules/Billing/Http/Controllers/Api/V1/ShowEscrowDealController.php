<?php

namespace Modules\Billing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\EscrowDeal;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Billing\Services\EscrowService;

#[Group('Escrow', weight: 36)]
class ShowEscrowDealController extends Controller
{
    public function __invoke(Request $request, string $uuid, EscrowService $escrow): JsonResponse
    {
        $deal = EscrowDeal::query()->with('listing')->where('uuid', $uuid)->firstOrFail();
        $user = $request->user();

        if ($deal->buyer_id !== $user->id && $deal->seller_id !== $user->id && ! $user->hasRole('admin')) {
            abort(403);
        }

        return response()->json(['data' => $escrow->toArray($deal)]);
    }
}

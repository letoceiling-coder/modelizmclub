<?php

namespace Modules\Delivery\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Delivery\Http\Resources\SellerDeliveryProfileResource;
use Modules\Delivery\Services\SellerDeliveryProfileService;

#[Group('Delivery — Seller profile', weight: 50)]
class IndexSellerDeliveryProfileController extends Controller
{
    public function __invoke(Request $request, SellerDeliveryProfileService $profiles): JsonResponse
    {
        $items = $profiles->listForUser($request->user());

        return response()->json([
            'data' => SellerDeliveryProfileResource::collection($items),
        ]);
    }
}

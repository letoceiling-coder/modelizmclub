<?php

namespace Modules\Delivery\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SellerDeliveryProfile;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Delivery\Services\SellerDeliveryProfileService;

#[Group('Delivery — Seller profile', weight: 50)]
class DestroySellerDeliveryProfileController extends Controller
{
    public function __invoke(
        Request $request,
        SellerDeliveryProfile $sellerDeliveryProfile,
        SellerDeliveryProfileService $profiles,
    ): JsonResponse {
        $profiles->assertOwnedBy($sellerDeliveryProfile, $request->user());
        $profiles->deactivate($sellerDeliveryProfile);

        return response()->json(['message' => 'ok']);
    }
}

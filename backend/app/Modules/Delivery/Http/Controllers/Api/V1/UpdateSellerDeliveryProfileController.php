<?php

namespace Modules\Delivery\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SellerDeliveryProfile;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Delivery\Http\Resources\SellerDeliveryProfileResource;
use Modules\Delivery\Services\SellerDeliveryProfileService;

#[Group('Delivery — Seller profile', weight: 50)]
class UpdateSellerDeliveryProfileController extends Controller
{
    public function __invoke(
        Request $request,
        SellerDeliveryProfile $sellerDeliveryProfile,
        SellerDeliveryProfileService $profiles,
    ): JsonResponse {
        $profiles->assertOwnedBy($sellerDeliveryProfile, $request->user());

        $data = $request->validate([
            'label' => ['sometimes', 'string', 'max:255'],
            'address' => ['sometimes', 'nullable', 'array'],
            'city_id' => ['sometimes', 'nullable', 'integer', 'exists:cities,id'],
            'is_default' => ['sometimes', 'boolean'],
            'meta' => ['sometimes', 'nullable', 'array'],
        ]);

        $profile = $profiles->update($sellerDeliveryProfile, $data);

        return response()->json([
            'data' => new SellerDeliveryProfileResource($profile),
        ]);
    }
}

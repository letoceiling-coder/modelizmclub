<?php

namespace Modules\Delivery\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SellerDeliveryProfile;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Modules\Delivery\Http\Resources\SellerDeliveryProfileResource;
use Modules\Delivery\Services\SellerDeliveryProfileService;

#[Group('Delivery — Seller profile', weight: 50)]
class StoreSellerDeliveryProfileController extends Controller
{
    public function __invoke(Request $request, SellerDeliveryProfileService $profiles): JsonResponse
    {
        $data = $request->validate([
            'provider' => ['required', Rule::in(['cdek', 'yandex'])],
            'point_type' => ['required', Rule::in(['warehouse', 'pickup_point'])],
            'external_point_id' => ['required', 'string', 'max:128'],
            'label' => ['nullable', 'string', 'max:255'],
            'address' => ['nullable', 'array'],
            'city_id' => ['nullable', 'integer', 'exists:cities,id'],
            'is_default' => ['nullable', 'boolean'],
            'meta' => ['nullable', 'array'],
        ]);

        $profile = $profiles->create($request->user(), $data);

        return response()->json([
            'data' => new SellerDeliveryProfileResource($profile),
        ], 201);
    }
}

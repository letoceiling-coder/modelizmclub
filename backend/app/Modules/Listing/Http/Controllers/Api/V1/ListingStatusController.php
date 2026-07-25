<?php

namespace Modules\Listing\Http\Controllers\Api\V1;

use App\Enums\ListingStatus;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Listing\Http\Resources\ListingResource;
use Modules\Listing\Services\ListingService;

class ListingStatusController extends Controller
{
    public function publish(string $uuid, Request $request, ListingService $listings): JsonResponse
    {
        return $this->apply($uuid, $request, $listings, ListingStatus::Published, [
            'promocode' => $request->input('promocode'),
            'placement_payment_uuid' => $request->input('placement_payment_uuid'),
        ]);
    }

    public function archive(string $uuid, Request $request, ListingService $listings): JsonResponse
    {
        return $this->apply($uuid, $request, $listings, ListingStatus::Unpublished);
    }

    /** @param  array<string, mixed>  $context */
    private function apply(string $uuid, Request $request, ListingService $listings, ListingStatus $status, array $context = []): JsonResponse
    {
        $listing = $listings->findOwned($uuid, $request->user());
        $listing = $listings->setStatus($listing, $request->user(), $status, $context);

        return response()->json([
            'data' => new ListingResource($listing),
        ]);
    }
}

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
        return $this->apply($uuid, $request, $listings, ListingStatus::Published);
    }

    public function archive(string $uuid, Request $request, ListingService $listings): JsonResponse
    {
        return $this->apply($uuid, $request, $listings, ListingStatus::Unpublished);
    }

    private function apply(string $uuid, Request $request, ListingService $listings, ListingStatus $status): JsonResponse
    {
        $listing = $listings->findOwned($uuid, $request->user());
        $listing = $listings->setStatus($listing, $request->user(), $status);

        return response()->json([
            'data' => new ListingResource($listing),
        ]);
    }
}

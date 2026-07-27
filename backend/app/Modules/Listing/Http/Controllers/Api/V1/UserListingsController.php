<?php

namespace Modules\Listing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Listing\Http\Resources\ListingResource;
use Modules\Listing\Services\ListingService;
use Modules\User\Services\UserService;

class UserListingsController extends Controller
{
    public function __invoke(string $slug, Request $request, ListingService $listings, UserService $users): JsonResponse
    {
        $profile = $users->getPublicProfile($slug, $request->user());

        $paginator = $listings->publicByUser(
            $profile->user,
            min($request->integer('per_page', 20), 50),
        );

        return ListingResource::collection($paginator)->response();
    }
}

<?php

namespace Modules\PublicContent\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Modules\PublicContent\Services\FeedGuestAccessService;

class FeedGuestAccessController extends Controller
{
    public function __invoke(FeedGuestAccessService $service): JsonResponse
    {
        return response()->json(['data' => $service->publicPayload()]);
    }
}

<?php

namespace Modules\PublicContent\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Modules\PublicContent\Services\LandingBlocksService;

class LandingBlocksController extends Controller
{
    public function __invoke(LandingBlocksService $landing): JsonResponse
    {
        return response()->json(['data' => $landing->publicPayload()]);
    }
}

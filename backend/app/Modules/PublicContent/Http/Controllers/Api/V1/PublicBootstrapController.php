<?php

namespace Modules\PublicContent\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Modules\PublicContent\Services\PublicBootstrapService;

class PublicBootstrapController extends Controller
{
    public function __invoke(PublicBootstrapService $bootstrap): JsonResponse
    {
        return response()->json(['data' => $bootstrap->payload()]);
    }
}

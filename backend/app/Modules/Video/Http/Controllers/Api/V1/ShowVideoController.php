<?php

namespace Modules\Video\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Video\Http\Resources\VideoResource;
use Modules\Video\Services\VideoService;

class ShowVideoController extends Controller
{
    public function __invoke(string $uuid, Request $request, VideoService $videos): JsonResponse
    {
        return response()->json([
            'data' => new VideoResource($videos->show($uuid, $request->user())),
        ]);
    }
}

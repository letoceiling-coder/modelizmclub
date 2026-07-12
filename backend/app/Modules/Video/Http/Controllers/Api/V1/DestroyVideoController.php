<?php

namespace Modules\Video\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Video;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Video\Services\VideoService;

class DestroyVideoController extends Controller
{
    public function __invoke(Request $request, string $uuid, VideoService $videos): JsonResponse
    {
        $video = Video::query()->where('uuid', $uuid)->firstOrFail();
        $videos->delete($video, $request->user());

        return response()->json(null, 204);
    }
}

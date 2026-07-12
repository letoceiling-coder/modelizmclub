<?php

namespace Modules\Video\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Video;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Video\Http\Resources\VideoResource;
use Modules\Video\Services\VideoService;

class UpdateVideoController extends Controller
{
    public function __invoke(Request $request, string $uuid, VideoService $videos): JsonResponse
    {
        $video = Video::query()->where('uuid', $uuid)->firstOrFail();
        $data = $request->validate(['is_featured' => ['sometimes', 'boolean']]);
        $updated = $videos->update($video, $request->user(), $data);

        return response()->json(['data' => new VideoResource($updated)]);
    }
}

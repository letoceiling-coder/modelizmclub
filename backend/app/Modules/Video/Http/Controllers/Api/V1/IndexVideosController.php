<?php

namespace Modules\Video\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Video\Http\Resources\VideoResource;
use Modules\Video\Services\VideoService;

class IndexVideosController extends Controller
{
    public function __invoke(Request $request, VideoService $videos): JsonResponse
    {
        $paginator = $videos->list([
            'q' => $request->query('q'),
            'category' => $request->query('category'),
            'featured' => $request->query('featured'),
        ], $request->user(), min(100, max(1, (int) $request->query('per_page', 50))));

        return response()->json([
            'data' => VideoResource::collection($paginator->items()),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }
}

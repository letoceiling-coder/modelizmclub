<?php

namespace Modules\Video\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Video\Services\VideoService;

class IndexVideoTagsController extends Controller
{
    public function __invoke(Request $request, VideoService $videos): JsonResponse
    {
        $q = $request->query('q');
        $q = is_string($q) ? trim($q) : null;

        return response()->json([
            'data' => $videos->listTags($q === '' ? null : $q),
        ]);
    }
}
